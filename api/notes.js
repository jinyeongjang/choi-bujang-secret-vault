import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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

  // 1. 요청 헤더의 Authorization 검사 (src/verify-login.mjs 사용)
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
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const match = pathname.match(/^\/api\/notes\/([^/?#]+)/);
        if (match) {
          noteId = match[1];
        }
      } catch (_e) {}
    }

    // A. 개별 메모 연산 (/api/notes/:id)
    if (noteId) {
      if (!UUID_REGEX.test(noteId)) {
        return response.status(404).json({ error: 'NOT_FOUND' });
      }

      if (request.method === 'GET') {
        // 단건 조회: { id, title, body } (소유자 검사는 4단계 전이므로 생략)
        const { data, error } = await supabase
          .from('notes')
          .select('id, title, content')
          .eq('id', noteId)
          .maybeSingle();

        if (error || !data) {
          return response.status(404).json({ error: 'NOT_FOUND' });
        }

        return response.status(200).json({
          id: data.id,
          title: data.title,
          body: data.content ?? data.body ?? '',
        });
      }

      if (request.method === 'PUT') {
        // 단건 수정: title, body 업데이트 (소유자 검사는 4단계 전이므로 B가 A 메모 수정 가능)
        let reqBody = request.body;
        if (typeof reqBody === 'string') {
          try { reqBody = JSON.parse(reqBody); } catch { reqBody = {}; }
        } else if (!reqBody || typeof reqBody !== 'object') {
          reqBody = {};
        }

        const title = reqBody.title;
        const bodyText = reqBody.body ?? reqBody.content;

        const updatePayload = {};
        if (title !== undefined) updatePayload.title = title;
        if (bodyText !== undefined) updatePayload.content = bodyText;

        const { data, error } = await supabase
          .from('notes')
          .update(updatePayload)
          .eq('id', noteId)
          .select('id, title, content')
          .maybeSingle();

        if (error || !data) {
          return response.status(404).json({ error: 'NOT_FOUND' });
        }

        return response.status(200).json({
          id: data.id,
          title: data.title,
          body: data.content ?? data.body ?? '',
        });
      }

      if (request.method === 'DELETE') {
        // 단건 삭제: 지운 뒤 GET은 404
        const { data, error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId)
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
        .select('id, title, content, created_at')
        .eq('owner_id', identity.userId)
        .order('created_at', { ascending: true });

      if (error) {
        return response.status(500).json({ error: 'DATABASE_QUERY_FAILED' });
      }

      const notes = (data ?? []).map(row => ({
        id: row.id,
        title: row.title,
        body: row.content ?? row.body ?? '',
      }));

      return response.status(200).json(notes);
    }

    if (request.method === 'POST') {
      // 메모 추가: { id, title, body } (id 없으면 서버가 UUID 생성하여 { id } 반환, owner_id 저장)
      let reqBody = request.body;
      if (typeof reqBody === 'string') {
        try { reqBody = JSON.parse(reqBody); } catch { reqBody = {}; }
      } else if (!reqBody || typeof reqBody !== 'object') {
        reqBody = {};
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
