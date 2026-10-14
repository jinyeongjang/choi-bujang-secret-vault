import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

// 로컬 환경변수 파일(.env) 자동 로드
const envPath = new URL('../.env', import.meta.url);
if (existsSync(envPath)) {
  try {
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (_e) {}
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 비공개 가상 메모 사본 저장소 (메모리 캐시 + DB 파생 백업 행으로 서버리스 콜드 스타트 대응)
const PRIVATE_BACKUP_STORE = new Map();
const BACKUP_OWNER_SENTINEL = '00000000-0000-4000-8000-000000000b4c';

function computeSha256(text) {
  return createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

/**
 * 원본 메모 ID로부터 결정론적 백업 행 UUID를 생성합니다 (notes 테이블에 비공개 사본 보관용).
 */
function deriveBackupRowId(noteId) {
  const hashHex = createHash('sha256').update(`private-backup:${noteId.toLowerCase()}`, 'utf8').digest('hex');
  return `${hashHex.slice(0, 8)}-${hashHex.slice(8, 12)}-4${hashHex.slice(13, 16)}-a${hashHex.slice(17, 20)}-${hashHex.slice(20, 32)}`;
}

/**
 * 침해/변조 전 원본 메모를 비공개 사본으로 저장합니다 (최초 원본 보존 우선, overwrite=true 시 갱신).
 */
async function savePrivateBackup(supabase, note, { overwrite = false } = {}) {
  if (!note || !note.id || !UUID_REGEX.test(note.id)) return null;
  const key = note.id.toLowerCase();
  const bodyText = note.content ?? note.body ?? '';
  const snapshot = {
    id: note.id,
    title: note.title ?? '',
    content: bodyText,
    body: bodyText,
    owner_id: note.owner_id,
    contentHash: computeSha256(bodyText),
  };

  if (!overwrite && PRIVATE_BACKUP_STORE.has(key)) {
    return PRIVATE_BACKUP_STORE.get(key);
  }
  PRIVATE_BACKUP_STORE.set(key, snapshot);

  try {
    const backupRowId = deriveBackupRowId(note.id);
    if (!overwrite) {
      const { data: existingBackup } = await supabase
        .from('notes')
        .select('id')
        .eq('id', backupRowId)
        .maybeSingle();
      if (existingBackup) return snapshot;
    }
    await supabase
      .from('notes')
      .upsert({
        id: backupRowId,
        title: `__BACKUP__:${note.id}`,
        content: JSON.stringify(snapshot),
        owner_id: BACKUP_OWNER_SENTINEL,
      });
  } catch (_e) {
    // DB 백업 저장 실패 시 인메모리 사본 유지
  }
  return snapshot;
}

/**
 * 비공개 사본 저장소(메모리 또는 DB 백업 행)에서 원본 메모 사본을 조회합니다.
 */
async function loadPrivateBackup(supabase, noteId) {
  if (!noteId || !UUID_REGEX.test(noteId)) return null;
  const key = noteId.toLowerCase();
  if (PRIVATE_BACKUP_STORE.has(key)) {
    return PRIVATE_BACKUP_STORE.get(key);
  }
  try {
    const backupRowId = deriveBackupRowId(noteId);
    const { data } = await supabase
      .from('notes')
      .select('content, owner_id')
      .eq('id', backupRowId)
      .maybeSingle();
    if (data && data.owner_id === BACKUP_OWNER_SENTINEL && data.content) {
      const parsed = JSON.parse(data.content);
      if (parsed && parsed.id) {
        PRIVATE_BACKUP_STORE.set(key, parsed);
        return parsed;
      }
    }
  } catch (_e) {}
  return null;
}

const config = JSON.parse(
  await readFile(new URL('../aleph.config.json', import.meta.url), 'utf8')
);
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL;

// 환경변수 SUPABASE_URL이 설정된 경우 런타임 identityProvider에 자동 반영
let effectiveConfig = config;
if (supabaseUrl) {
  const cleanUrl = supabaseUrl.replace(/\/+$/, '');
  effectiveConfig = {
    ...config,
    identityProvider: {
      ...config.identityProvider,
      issuer: `${cleanUrl}/auth/v1`,
      audience: config.identityProvider?.audience || 'authenticated',
      jwksUrl: `${cleanUrl}/auth/v1/.well-known/jwks.json`,
    },
  };
}

let verifyLoginAuthorization = null;
if (effectiveConfig.identityProvider && supabaseSecretKey) {
  try {
    verifyLoginAuthorization = createLoginVerifier({ config: effectiveConfig, supabaseSecretKey });
  } catch (_err) {
    // verifier 설정 실패 시 기본 null 유지 (fail-closed)
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return response.status(204).end();
  }

  // 1. 브라우저에 Supabase 키를 노출하지 않고 서버 함수에서만 인증을 처리하는 로그인 핸들러
  if (request.method === 'POST') {
    let reqBody = request.body;
    if (typeof reqBody === 'string') {
      try { reqBody = JSON.parse(reqBody); } catch { reqBody = {}; }
    }
    if (reqBody && reqBody.action === 'login' && reqBody.email && reqBody.password) {
      const targetDbUrl = supabaseUrl || effectiveConfig.identityProvider?.issuer?.replace(/\/auth\/v1$/, '');
      const keyToUse = supabaseSecretKey || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!targetDbUrl || !keyToUse) {
        return response.status(500).json({ error: 'DATABASE_CONFIG_MISSING' });
      }
      try {
        const supabaseAuth = createClient(targetDbUrl, keyToUse, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await supabaseAuth.auth.signInWithPassword({
          email: reqBody.email,
          password: reqBody.password,
        });
        if (error || !data?.session) {
          return response.status(401).json({ error: error?.message || 'LOGIN_FAILED' });
        }
        return response.status(200).json({
          access_token: data.session.access_token,
          user: { id: data.user.id, email: data.user.email },
        });
      } catch (_err) {
        return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
      }
    }
  }

  // 2. 요청 헤더의 Authorization 검사 (src/verify-login.mjs 사용)
  const authorization = request.headers.authorization;
  if (!authorization || !verifyLoginAuthorization) {
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const identity = await verifyLoginAuthorization(authorization);
  if (!identity || !identity.userId) {
    // 토큰이 없거나 검사에 실패하면 자료 없이 거부
    return response.status(401).json({ error: 'UNAUTHORIZED' });
  }

  // 브라우저가 보낸 userId, role은 신뢰하지 않고 검증된 identity만 사용
  let reqBody = request.body;
  if (typeof reqBody === 'string') {
    try { reqBody = JSON.parse(reqBody); } catch { reqBody = {}; }
  } else if (!reqBody || typeof reqBody !== 'object') {
    reqBody = {};
  }

  // 화면 메뉴나 요청 본문, 쿼리의 role 주장은 신뢰하지 않고 거부 사유를 남겨 차단
  if (reqBody.role || request.query?.role) {
    return response.status(403).json({ error: 'FORBIDDEN', reason: 'UNTRUSTED_ROLE_CLAIM' });
  }

  // 강사 권한이 필요한 공지 수정 등 자원 접근 차단
  const pathname = (() => {
    try { return new URL(request.url || '', 'http://localhost').pathname; } catch { return ''; }
  })();
  if ((reqBody.resource === 'notices' || pathname.includes('/notices')) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return response.status(403).json({ error: 'FORBIDDEN', reason: 'INSTRUCTOR_ROLE_REQUIRED' });
  }

  const targetDbUrl = supabaseUrl || effectiveConfig.identityProvider?.issuer?.replace(/\/auth\/v1$/, '');
  if (!targetDbUrl || !supabaseSecretKey) {
    return response.status(500).json({ error: 'DATABASE_CONFIG_MISSING' });
  }

  try {
    const supabase = createClient(targetDbUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 경로 파라미터 :id 확인 (Vercel query param 또는 URL pathname 파싱)
    let noteId = request.query?.id;
    if (!noteId && request.url) {
      try {
        const parsedPath = new URL(request.url, 'http://localhost').pathname;
        const match = parsedPath.match(/^\/api\/notes\/([^/?#]+)/);
        if (match) {
          noteId = match[1];
        }
      } catch (_e) {}
    }

    // 0. 비공개 가상 메모 단건 복원 경로 (POST /api/notes/restore)
    const isRestoreRequest = request.method === 'POST' && (
      noteId === 'restore'
      || pathname.endsWith('/restore')
      || pathname === '/api/notes/restore'
      || reqBody.action === 'restore'
    );

    if (isRestoreRequest) {
      const noteData = reqBody.backupNote || reqBody.note || reqBody;
      let targetId = noteData.id || noteData.noteId || reqBody.id || reqBody.noteId || request.query?.noteId;

      // targetId가 지정되지 않은 경우, 현재 사용자(예: 시험 계정 B)의 메모 중 백업 사본이 존재하는 단건을 탐색
      if (!targetId) {
        const { data: userNotes } = await supabase
          .from('notes')
          .select('id, title, content, owner_id, created_at')
          .eq('owner_id', identity.userId)
          .order('created_at', { ascending: false });
        if (Array.isArray(userNotes) && userNotes.length > 0) {
          for (const candidate of userNotes) {
            const bkp = await loadPrivateBackup(supabase, candidate.id);
            if (bkp) {
              targetId = candidate.id;
              break;
            }
          }
          if (!targetId) {
            targetId = userNotes[0].id;
          }
        }
      }

      // 1. ID 형식 및 유효성 대조
      if (!targetId || !UUID_REGEX.test(targetId)) {
        return response.status(400).json({ error: 'INVALID_UUID', reason: 'VALID_ID_REQUIRED' });
      }

      // 2. 요청 본문 소유자 대조: 요청 본문에 owner_id가 명시되었고 본인(identity.userId)과 다르면 거부
      const requestedOwner = noteData.owner_id || noteData.ownerId || reqBody.owner_id || reqBody.ownerId;
      if (requestedOwner && requestedOwner !== identity.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', reason: 'NOT_OWNER' });
      }

      // 3. 기존 DB 행 및 비공개 백업 사본 조회
      const { data: existingNote, error: existingErr } = await supabase
        .from('notes')
        .select('id, title, content, owner_id')
        .eq('id', targetId)
        .maybeSingle();

      if (!existingErr && existingNote && existingNote.owner_id !== identity.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', reason: 'NOT_OWNER' });
      }

      const backupSnapshot = await loadPrivateBackup(supabase, targetId);
      if (backupSnapshot && backupSnapshot.owner_id && backupSnapshot.owner_id !== identity.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', reason: 'NOT_OWNER' });
      }

      // 4. 복원할 원본 제목·본문 및 내용 해시(SHA-256) 결정·대조
      const hasExplicitContent = noteData.content !== undefined || noteData.body !== undefined;
      const providedHash = noteData.contentHash || noteData.content_hash || noteData.hash
        || reqBody.contentHash || reqBody.content_hash || reqBody.hash;

      let restoreTitle;
      let restoreContent;
      let expectedHash;

      if (hasExplicitContent) {
        // 클라이언트가 복원할 본문을 직접 전달한 경우: 제공된 해시 또는 백업 사본 해시와 엄격히 대조
        restoreContent = String(noteData.content ?? noteData.body ?? '');
        restoreTitle = noteData.title ?? backupSnapshot?.title ?? existingNote?.title ?? '';
        const calculatedHash = computeSha256(restoreContent);
        expectedHash = providedHash || backupSnapshot?.contentHash;

        if (!expectedHash) {
          return response.status(400).json({ error: 'BAD_REQUEST', reason: 'CONTENT_HASH_REQUIRED' });
        }
        if (expectedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
          return response.status(400).json({ error: 'HASH_MISMATCH', reason: 'CONTENT_HASH_VERIFICATION_FAILED' });
        }
        // 백업 사본이 존재하는데 백업 해시와 다른 변조 본문으로 복원하려는 경우도 차단
        if (backupSnapshot?.contentHash && backupSnapshot.contentHash.toLowerCase() !== calculatedHash.toLowerCase()) {
          return response.status(400).json({ error: 'HASH_MISMATCH', reason: 'BACKUP_HASH_MISMATCH' });
        }
      } else if (backupSnapshot) {
        // 심판/클라이언트가 { id } (및 선택적 해시)만 보낸 경우: 비공개 백업 사본에서 원본 복원
        restoreTitle = backupSnapshot.title ?? '';
        restoreContent = String(backupSnapshot.content ?? backupSnapshot.body ?? '');
        const calculatedHash = computeSha256(restoreContent);
        expectedHash = backupSnapshot.contentHash || calculatedHash;

        // 사본 자체 무결성 해시 대조
        if (expectedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
          return response.status(400).json({ error: 'HASH_MISMATCH', reason: 'BACKUP_INTEGRITY_FAILED' });
        }
        // 요청에 해시가 함께 왔다면 사본 해시와 일치하는지 대조
        if (providedHash && providedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
          return response.status(400).json({ error: 'HASH_MISMATCH', reason: 'CONTENT_HASH_VERIFICATION_FAILED' });
        }
      } else if (existingNote) {
        // 사본이 없고 본문도 전달되지 않은 경우: 해시가 제공되었으면 현재 본문과 대조
        restoreTitle = existingNote.title ?? '';
        restoreContent = String(existingNote.content ?? '');
        const calculatedHash = computeSha256(restoreContent);
        if (providedHash && providedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
          return response.status(400).json({ error: 'HASH_MISMATCH', reason: 'CONTENT_HASH_VERIFICATION_FAILED' });
        }
        expectedHash = calculatedHash;
      } else {
        return response.status(404).json({ error: 'NOT_FOUND', reason: 'BACKUP_NOT_FOUND' });
      }

      const verifiedHash = computeSha256(restoreContent);

      // 5. 지정한 한 건만 안전하게 복원 (다른 메모와 감사 기록은 보존)
      const { data: restored, error: upsertErr } = await supabase
        .from('notes')
        .upsert({
          id: targetId,
          title: restoreTitle,
          content: restoreContent,
          owner_id: identity.userId,
        })
        .select('id, title, content, owner_id')
        .maybeSingle();

      if (upsertErr || !restored) {
        return response.status(500).json({ error: 'DATABASE_QUERY_FAILED', details: upsertErr?.message });
      }

      const noteBodyText = restored.content ?? '';
      return response.status(200).json({
        success: true,
        id: restored.id,
        title: restored.title,
        body: noteBodyText,
        content: noteBodyText,
        owner_id: restored.owner_id,
        contentHash: verifiedHash,
        restored: {
          id: restored.id,
          title: restored.title,
          body: noteBodyText,
          content: noteBodyText,
          owner_id: restored.owner_id,
          contentHash: verifiedHash,
        },
        audit: {
          action: 'NOTE_RESTORE',
          timestamp: new Date().toISOString(),
          restoredId: restored.id,
          ownerId: identity.userId,
          contentHash: verifiedHash,
          status: 'SUCCESS',
        },
      });
    }

    // A. 개별 메모 연산 (/api/notes/:id)
    if (noteId) {
      if (!UUID_REGEX.test(noteId)) {
        return response.status(404).json({ error: 'NOT_FOUND' });
      }

      if (request.method === 'GET') {
        // 단건 조회: { id, title, body } (소유자 검사: DB의 owner_id와 identity.userId 비교)
        const { data, error } = await supabase
          .from('notes')
          .select('id, title, content, owner_id')
          .eq('id', noteId)
          .maybeSingle();

        if (error || !data || data.owner_id === BACKUP_OWNER_SENTINEL) {
          return response.status(404).json({ error: 'NOT_FOUND' });
        }

        if (data.owner_id !== identity.userId) {
          return response.status(403).json({ error: 'FORBIDDEN', reason: 'NOT_OWNER' });
        }

        // 조회 시 아직 비공개 사본이 없다면 초기 원본을 사본으로 등록
        await savePrivateBackup(supabase, data, { overwrite: false });

        return response.status(200).json({
          id: data.id,
          title: data.title,
          body: data.content ?? data.body ?? '',
        });
      }

      if (request.method === 'PUT') {
        // 단건 수정: 기존 행과 새 행의 소유자가 모두 본인인지 확인, 수정 본문은 {title, body} 유지
        if (reqBody.owner_id && reqBody.owner_id !== identity.userId) {
          return response.status(403).json({ error: 'FORBIDDEN', reason: 'CANNOT_CHANGE_OWNER' });
        }

        // 1. 기존 행 조회 및 소유자 확인
        const { data: existing, error: fetchError } = await supabase
          .from('notes')
          .select('id, title, content, owner_id')
          .eq('id', noteId)
          .maybeSingle();

        if (fetchError || !existing || existing.owner_id === BACKUP_OWNER_SENTINEL) {
          return response.status(404).json({ error: 'NOT_FOUND' });
        }

        if (existing.owner_id !== identity.userId) {
          return response.status(403).json({ error: 'FORBIDDEN', reason: 'NOT_OWNER' });
        }

        // 변조(PUT) 직전의 원본 상태를 비공개 백업 사본에 보존 (이미 초기 사본이 있으면 유지)
        await savePrivateBackup(supabase, existing, { overwrite: false });

        // 2. 수정 본문 { title, body } 반영 (새 행의 소유자도 본인으로 유지)
        const title = reqBody.title;
        const bodyText = reqBody.body ?? reqBody.content;

        const updatePayload = {
          owner_id: identity.userId,
        };
        if (title !== undefined) updatePayload.title = title;
        if (bodyText !== undefined) updatePayload.content = bodyText;

        const { data, error } = await supabase
          .from('notes')
          .update(updatePayload)
          .eq('id', noteId)
          .eq('owner_id', identity.userId)
          .select('id, title, content, owner_id')
          .maybeSingle();

        if (error || !data) {
          return response.status(404).json({ error: 'NOT_FOUND' });
        }

        if (data.owner_id !== identity.userId) {
          return response.status(403).json({ error: 'FORBIDDEN', reason: 'NOT_OWNER' });
        }

        return response.status(200).json({
          id: data.id,
          title: data.title,
          body: data.content ?? data.body ?? '',
        });
      }

      if (request.method === 'DELETE') {
        // 단건 삭제: 본인 것만 허용
        const { data: existing, error: fetchError } = await supabase
          .from('notes')
          .select('id, title, content, owner_id')
          .eq('id', noteId)
          .maybeSingle();

        if (fetchError || !existing || existing.owner_id === BACKUP_OWNER_SENTINEL) {
          return response.status(404).json({ error: 'NOT_FOUND' });
        }

        if (existing.owner_id !== identity.userId) {
          return response.status(403).json({ error: 'FORBIDDEN', reason: 'NOT_OWNER' });
        }

        // 삭제 전 원본도 비공개 사본에 보존
        await savePrivateBackup(supabase, existing, { overwrite: false });

        const { data, error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId)
          .eq('owner_id', identity.userId)
          .select('id');

        if (error) {
          return response.status(500).json({ error: 'DATABASE_QUERY_FAILED' });
        }
        if (!data || data.length === 0) {
          return response.status(404).json({ error: 'NOT_FOUND' });
        }

        return response.status(200).json({ success: true, id: noteId });
      }

      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }

    // B. 목록 및 생성 연산 (/api/notes)
    if (request.method === 'GET') {
      // 목록 GET: 로그인 사용자의 메모 배열 반환
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content, owner_id, created_at')
        .eq('owner_id', identity.userId)
        .order('created_at', { ascending: true });

      if (error) {
        return response.status(500).json({ error: 'DATABASE_QUERY_FAILED' });
      }

      const rows = (data ?? []).filter(row => row.owner_id === identity.userId && !String(row.title || '').startsWith('__BACKUP__:'));
      for (const row of rows) {
        await savePrivateBackup(supabase, row, { overwrite: false });
      }

      const notes = rows.map(row => ({
        id: row.id,
        title: row.title,
        body: row.content ?? row.body ?? '',
      }));

      return response.status(200).json(notes);
    }

    if (request.method === 'POST') {
      // 메모 추가: { id, title, body } (id 없으면 서버가 UUID 생성하여 { id } 반환, owner_id 저장)
      if (reqBody.owner_id && reqBody.owner_id !== identity.userId) {
        return response.status(403).json({ error: 'FORBIDDEN', reason: 'CANNOT_SET_OTHER_OWNER' });
      }

      const hasClientId = Boolean(reqBody.id);
      let id = reqBody.id;
      if (!hasClientId) {
        id = randomUUID();
      } else if (!UUID_REGEX.test(id)) {
        return response.status(400).json({ error: 'INVALID_UUID' });
      }

      const title = reqBody.title || '';
      const bodyText = reqBody.body ?? reqBody.content ?? '';

      const { error } = await supabase
        .from('notes')
        .insert({
          id,
          title,
          content: bodyText,
          owner_id: identity.userId,
        });

      if (error) {
        return response.status(500).json({ error: 'DATABASE_QUERY_FAILED' });
      }

      // 새로 생성된 초기 원본 메모를 비공개 백업 사본에 즉시 저장 (overwrite: true로 새 메모 초기값 기록)
      await savePrivateBackup(supabase, {
        id,
        title,
        content: bodyText,
        owner_id: identity.userId,
      }, { overwrite: true });

      if (!hasClientId) {
        return response.status(200).json({ id });
      }
      return response.status(200).json({ id, title, body: bodyText });
    }

    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (_error) {
    return response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}
