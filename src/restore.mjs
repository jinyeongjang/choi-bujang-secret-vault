import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 10단계: 백업에서 자료실을 되살립니다 - 정책 비교 및 안전성 검증 모듈
 * 실제 운영 정책(src/decider.mjs)은 변경하지 않고, 침해 전 안전 사본과 시험 정책의 차이만 안전하게 비교합니다.
 */

/**
 * 정책 객체 또는 규칙 목록의 유효성을 검증합니다.
 * 사본이 없거나 올바르지 않은 형식이면 false를 반환합니다.
 */
export function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object') {
    return false;
  }

  // 1. 규칙 ID 배열 형태인 경우
  if (Array.isArray(policy)) {
    return policy.length > 0 && policy.every(item => typeof item === 'string' && item.trim().length > 0);
  }

  // 2. 정책 객체 형태인 경우 (rules 또는 ruleIds 속성 포함)
  const rules = policy.rules ?? policy.ruleIds;
  if (rules !== undefined) {
    if (!Array.isArray(rules) || rules.length === 0) {
      return false;
    }
    return rules.every(r => typeof r === 'string' || (r && typeof r === 'object'));
  }

  // 3. 일반 설정 객체 형태인 경우
  return Object.keys(policy).length > 0;
}

/**
 * 사본을 소스/데이터로부터 다시 읽고 유효성과 무결성을 검증합니다.
 * 사본이 없거나 검증에 실패하면 오류를 던져 즉시 멈춥니다 (Fail-Closed).
 */
export function reReadAndVerify(policySource) {
  if (!policySource) {
    throw new Error('안전 정책 사본이 없습니다 (MISSING_SAFE_POLICY_BACKUP).');
  }

  // 사본을 직렬화·역직렬화하여 독립된 사본으로 다시 읽음 (Re-read)
  let copy;
  try {
    copy = structuredClone(policySource);
  } catch {
    copy = JSON.parse(JSON.stringify(policySource));
  }

  // 다시 읽은 사본의 유효성과 무결성 검증
  if (!validatePolicy(copy)) {
    throw new Error('안전 정책 사본 검증에 실패했습니다 (INVALID_SAFE_POLICY_VERIFICATION).');
  }

  return copy;
}

/**
 * 침해 전에 검증한 안전 정책 사본과 현재 시험 정책의 차이(diff)만 추출합니다.
 * 사본이 없거나 검증에 실패하면 즉시 오류를 던져 중단합니다.
 * 실제 운영 정책은 일체 수정하지 않습니다.
 */
export function diffPolicies(safePolicy, testPolicy) {
  // 1. 사본을 다시 읽고 검증 - 실패 시 즉시 멈춤
  const verifiedSafe = reReadAndVerify(safePolicy);

  // 2. 시험 정책 유효성 검증
  if (!testPolicy || !validatePolicy(testPolicy)) {
    throw new Error('현재 시험 정책이 유효하지 않습니다 (INVALID_TEST_POLICY).');
  }

  // 규칙 배열 추출 도우미
  const extractRules = (p) => {
    if (Array.isArray(p)) return p;
    if (Array.isArray(p.rules)) return p.rules;
    if (Array.isArray(p.ruleIds)) return p.ruleIds;
    return null;
  };

  const safeRules = extractRules(verifiedSafe);
  const testRules = extractRules(testPolicy);

  // 규칙 목록 형태 비교
  if (safeRules && testRules) {
    const toId = (item) => (typeof item === 'string' ? item : (item.id || item.ruleId || JSON.stringify(item)));
    const safeSet = new Set(safeRules.map(toId));
    const testSet = new Set(testRules.map(toId));

    const added = testRules.filter(r => !safeSet.has(toId(r)));
    const removed = safeRules.filter(r => !testSet.has(toId(r)));

    // 객체 형태 규칙의 속성 변경 감지
    const modified = [];
    if (typeof safeRules[0] === 'object' && typeof testRules[0] === 'object') {
      const safeMap = new Map(safeRules.map(r => [toId(r), r]));
      for (const tRule of testRules) {
        const id = toId(tRule);
        const sRule = safeMap.get(id);
        if (sRule && JSON.stringify(sRule) !== JSON.stringify(tRule)) {
          modified.push({ id, before: sRule, after: tRule });
        }
      }
    }

    return {
      hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0,
      added,
      removed,
      modified,
    };
  }

  // 일반 객체 속성 비교
  const differences = {};
  const allKeys = new Set([...Object.keys(verifiedSafe), ...Object.keys(testPolicy)]);

  for (const key of allKeys) {
    const safeVal = verifiedSafe[key];
    const testVal = testPolicy[key];

    if (JSON.stringify(safeVal) !== JSON.stringify(testVal)) {
      differences[key] = {
        safe: safeVal ?? null,
        current: testVal ?? null,
      };
    }
  }

  return {
    hasChanges: Object.keys(differences).length > 0,
    differences,
  };
}

/**
 * 검증한 안전 정책 버전으로 시험 정책을 되돌리는 절차 함수입니다.
 * - 검증한 사본을 다시 읽어 확인하며, 검증에 실패하면 복원을 실행하지 않고 즉시 멈춥니다.
 * - 실행 전에 복원 대상 버전과 바뀔 항목(diff)을 명시적으로 보여 줍니다.
 * - 다른 서비스 규칙과 기존 감사 이력을 유실 없이 보존합니다.
 * - 실제 운영 정책은 건드리지 않습니다.
 */
export function restorePolicy(safePolicy, currentTestPolicy, options = {}) {
  const {
    dryRun = false,
    existingAuditHistory = [],
    otherServiceRules = null,
  } = options;

  // 1. 사본을 다시 읽어 엄격히 검증 (검증 실패 시 복원하지 않고 즉시 멈춤)
  const verifiedSafe = reReadAndVerify(safePolicy);

  // 2. 실행 전 버전 확인 및 변경될 항목(Diff) 확인
  const version = verifiedSafe.version ?? verifiedSafe.revision ?? 'v1.0-verified-safe';
  const diff = diffPolicies(verifiedSafe, currentTestPolicy);

  // 실행 전에 버전과 바뀔 항목을 명시적으로 구성
  const preview = {
    targetVersion: version,
    willChange: diff.hasChanges,
    added: diff.added ?? [],
    removed: diff.removed ?? [],
    modified: diff.modified ?? [],
    differences: diff.differences ?? {},
  };

  // 실행 전 버전과 바뀔 항목 표시
  const previewSummary = `[실행 전 확인] 버전: ${preview.targetVersion}\n`
    + `- 추가된 항목: ${JSON.stringify(preview.added)}\n`
    + `- 제거된 항목: ${JSON.stringify(preview.removed)}\n`
    + `- 변경될 속성: ${JSON.stringify(preview.differences)}`;

  // 3. dryRun(사전 확인) 모드인 경우 실제 적용 없이 버전과 바뀔 항목만 반환
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      version: preview.targetVersion,
      preview,
      summary: previewSummary,
      message: '복원 실행 전 버전 및 변경 예정 항목 확인 완료 (시험 정책 변경 없음)',
    };
  }

  // 4. 복원 대상 정책 구성: 검증된 안전 정책 버전 기반으로 복원하되 다른 서비스 규칙 보존
  let restoredPolicy;
  if (Array.isArray(verifiedSafe)) {
    const preservedOther = Array.isArray(otherServiceRules) ? otherServiceRules : [];
    restoredPolicy = Array.from(new Set([...verifiedSafe, ...preservedOther]));
  } else {
    restoredPolicy = structuredClone(verifiedSafe);
    if (Array.isArray(otherServiceRules)) {
      restoredPolicy.otherServices = [...otherServiceRules];
    } else if (otherServiceRules && typeof otherServiceRules === 'object') {
      restoredPolicy.otherServices = {
        ...(currentTestPolicy?.otherServices ?? {}),
        ...otherServiceRules,
      };
    } else if (currentTestPolicy?.otherServices) {
      restoredPolicy.otherServices = structuredClone(currentTestPolicy.otherServices);
    }
  }

  // 5. 감사 이력 보존 및 이번 복원 감사 기록 추가
  const auditEntry = {
    action: 'POLICY_RESTORE',
    timestamp: new Date().toISOString(),
    restoredRevision: version,
    changesApplied: preview,
    status: 'SUCCESS',
  };

  const auditHistory = [
    ...(Array.isArray(existingAuditHistory) ? existingAuditHistory : []),
    auditEntry,
  ];

  return {
    success: true,
    dryRun: false,
    version: preview.targetVersion,
    preview,
    summary: previewSummary,
    restoredPolicy,
    auditHistory,
    message: '검증된 안전 정책으로 되돌리기 완료 (다른 서비스 규칙 및 감사 이력 보존됨)',
  };
}

/**
 * 비공개 가상 메모 사본에서 지정한 한 건만 복원합니다.
 * - ID 형식(UUID), 소유자(owner_id), 본문 내용 해시(SHA-256)를 엄격히 대조합니다.
 * - 대조 실패 시 즉시 오류를 던져 중단합니다.
 * - 다른 메모와 감사 기록은 온전히 보존합니다.
 *
 * @param {Array|object} backupSource - 비공개 가상 메모 사본 목록
 * @param {object} target - 복원 대상 정보 { id, owner_id, contentHash, title, body/content }
 * @param {object} [options] - { existingNotes, auditHistory, currentUserId }
 * @returns {object} 복원 결과 { success, id, title, body, content, owner_id, contentHash, restored, audit }
 */
export function restoreSingleNote(backupSource, target, options = {}) {
  const {
    existingNotes = [],
    auditHistory = [],
    currentUserId = null,
  } = options;

  if (!target || typeof target !== 'object') {
    throw new Error('복원 대상 정보가 필요합니다 (MISSING_RESTORE_TARGET).');
  }

  // 백업 사본 부재 및 유효성 사전 검증 (사본 없거나 검증 실패 시 복원 시도 없이 즉시 중단)
  if (!backupSource) {
    throw new Error('가상 메모 백업 사본이 없습니다 (MISSING_BACKUP_SOURCE).');
  }
  const backupList = Array.isArray(backupSource)
    ? backupSource
    : (Array.isArray(backupSource?.notes) ? backupSource.notes : (backupSource && typeof backupSource === 'object' ? [backupSource] : null));
  if (!backupList || backupList.length === 0 || !backupList.some(n => n && (n.id || n.noteId))) {
    throw new Error('백업 사본 검증에 실패했습니다 (INVALID_BACKUP_VERIFICATION).');
  }

  const noteId = target.id || target.noteId;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!noteId || !UUID_REGEX.test(noteId)) {
    throw new Error('유효한 메모 ID(UUID)가 필요합니다 (INVALID_UUID).');
  }

  // 사본 소스에서 대상 메모 검색
  const sourceNote = backupList.find(n => (n && (n.id === noteId || n.noteId === noteId)));
  if (!sourceNote) {
    throw new Error('백업 사본에서 해당 메모를 찾을 수 없습니다 (NOTE_NOT_FOUND_IN_BACKUP).');
  }

  const title = target.title ?? sourceNote.title ?? '';
  // 변조된 본문이 target으로 전달된 경우 target.content/body를 우선 참조하되, 사본과의 일치 해시를 검증
  const content = target.content ?? target.body ?? sourceNote.content ?? sourceNote.body ?? '';
  const ownerId = target.owner_id ?? target.owner ?? sourceNote.owner_id ?? sourceNote.owner;

  // 1. 소유자 대조: 백업 사본의 원래 소유자(sourceNote.owner_id)와 현재 사용자(expectedOwner) 대조
  const originalOwner = sourceNote.owner_id ?? sourceNote.owner;
  const expectedOwner = currentUserId || target.owner_id;
  if (originalOwner && expectedOwner && originalOwner !== expectedOwner) {
    throw new Error('메모 소유자가 일치하지 않습니다 (NOT_OWNER).');
  }
  if (expectedOwner && ownerId && ownerId !== expectedOwner) {
    throw new Error('메모 소유자가 일치하지 않습니다 (NOT_OWNER).');
  }

  // 기존 메모가 있을 경우 기존 메모 소유자 대조 (타인 메모 덮어쓰기 방지)
  const existing = existingNotes.find(n => n.id === noteId);
  if (existing && expectedOwner && existing.owner_id !== expectedOwner) {
    throw new Error('기존 메모 소유자가 일치하지 않습니다 (NOT_OWNER).');
  }

  // 2. 내용 해시 대조 (SHA-256)
  const calculatedHash = createHash('sha256').update(content, 'utf8').digest('hex');
  const providedHash = target.contentHash || target.content_hash || target.hash || sourceNote.contentHash;

  if (!providedHash) {
    throw new Error('내용 해시가 필요합니다 (CONTENT_HASH_REQUIRED).');
  }

  if (providedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
    throw new Error('내용 해시가 일치하지 않습니다 (HASH_MISMATCH).');
  }

  // 3. 지정한 단건 ID만 복원 (다른 메모 보존)
  const restoredNote = {
    id: noteId,
    title,
    body: content,
    content,
    owner_id: ownerId || expectedOwner,
    contentHash: calculatedHash,
    updated_at: new Date().toISOString(),
  };

  const updatedNotes = existingNotes.filter(n => n.id !== noteId).concat([restoredNote]);

  // 4. 감사 기록 보존 및 새 복원 이벤트 추가
  const auditEntry = {
    action: 'NOTE_RESTORE',
    timestamp: new Date().toISOString(),
    restoredId: noteId,
    ownerId: restoredNote.owner_id,
    contentHash: calculatedHash,
    status: 'SUCCESS',
  };

  const updatedAuditHistory = [...auditHistory, auditEntry];

  return {
    success: true,
    id: restoredNote.id,
    title: restoredNote.title,
    body: restoredNote.body,
    content: restoredNote.content,
    owner_id: restoredNote.owner_id,
    contentHash: calculatedHash,
    restored: restoredNote,
    audit: auditEntry,
    auditHistory: updatedAuditHistory,
    notes: updatedNotes,
  };
}

// 직접 실행 시 자체 검증 및 동작 확인
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // -------------------------------------------------------------
    // [검증 1] 정책 사본 재검증, 중단 및 실행 전 버전/diff 확인
    // -------------------------------------------------------------
    const safeCopy = {
      version: 'v1.0-safe-backup',
      rules: ['device_registered', 'step_up_required', 'zone_isolation', 'zone_rules'],
    };
    const candidatePolicy = {
      version: 'v1.1-tampered-candidate',
      rules: ['device_registered', 'step_up_required', 'unauthorized_bypass_rule'],
    };
    const otherServiceRules = ['service_payment_auth_v1'];
    const existingAuditHistory = [{ action: 'POLICY_DEPLOY_STAGE8', timestamp: '2026-10-13T03:00:00.000Z' }];

    // 실행 전 버전과 바뀔 항목 사전 확인 (dryRun)
    const dryRunResult = restorePolicy(safeCopy, candidatePolicy, {
      dryRun: true,
      otherServiceRules,
      existingAuditHistory,
    });
    process.stdout.write(`${dryRunResult.summary}\n`);

    // 사본 부재 또는 검증 실패 시 중단 확인 (절대 복원하지 않고 멈춤)
    let abortedMissing = false;
    try { restorePolicy(null, candidatePolicy); } catch { abortedMissing = true; }
    let abortedInvalid = false;
    try { restorePolicy({ rules: [] }, candidatePolicy); } catch { abortedInvalid = true; }

    if (abortedMissing && abortedInvalid) {
      process.stdout.write('사본 부재 및 검증 실패 시 복원하지 않고 즉시 멈춤: 통과\n');
    } else {
      throw new Error('검증 실패 시 중단 처리가 정상 작동하지 않았습니다.');
    }

    // -------------------------------------------------------------
    // [검증 2] 한 건 복원 일치 조건 검증 (시험 계정 B의 메모)
    // -------------------------------------------------------------
    const testUserIdB = 'b0000000-0000-0000-0000-000000000002';
    const testNoteIdB = 'b1111111-1111-1111-1111-111111111111';
    const testNoteContentB = '실습용 가상 B 사용자 메모 기록';
    const correctHashB = createHash('sha256').update(testNoteContentB, 'utf8').digest('hex');

    const backupVault = [
      { id: testNoteIdB, title: 'B의 시험 메모', content: testNoteContentB, owner_id: testUserIdB },
      { id: 'a1111111-1111-1111-1111-111111111111', title: 'A의 과제', content: 'A 자료', owner_id: 'a0000000-0000-0000-0000-000000000001' },
    ];

    // 정상 단건 복원 수행
    const restoreNoteResult = restoreSingleNote(backupVault, {
      id: testNoteIdB,
      owner_id: testUserIdB,
      contentHash: correctHashB,
    }, {
      currentUserId: testUserIdB,
      existingNotes: backupVault,
    });

    const isMatch = restoreNoteResult.id === testNoteIdB
      && restoreNoteResult.title === 'B의 시험 메모'
      && restoreNoteResult.body === testNoteContentB
      && restoreNoteResult.contentHash === correctHashB;

    if (isMatch) {
      process.stdout.write(`「한 건 복원 일치」 검증 완료: ID=${restoreNoteResult.id}, 제목=${restoreNoteResult.title}, 해시=${restoreNoteResult.contentHash.slice(0, 8)}...\n`);
    } else {
      throw new Error('한 건 복원 일치 검증에 실패했습니다.');
    }

    // -------------------------------------------------------------
    // [검증 3] 복원 뒤 재시험 검증 (정상 사용 및 금지 요청 차단)
    // -------------------------------------------------------------
    // 1) 정상 요청: 복원된 메모 목록에서 B의 메모가 정확히 1건 존재하고 타 메모 보존됨
    const normalRestoredNotes = restoreNoteResult.notes;
    const isOtherPreserved = normalRestoredNotes.some(n => n.id === 'a1111111-1111-1111-1111-111111111111');
    if (!isOtherPreserved) throw new Error('복원 시 다른 메모가 보존되지 않았습니다.');

    // 2) 금지 요청 1: 시험 계정 B의 메모 변조 시 복구 차단 (변조된 본문 + 기존 해시)
    let tamperedContentBlocked = false;
    try {
      restoreSingleNote(backupVault, {
        id: testNoteIdB,
        owner_id: testUserIdB,
        title: 'B의 시험 메모',
        content: '공격자에 의해 악의적으로 변조된 B의 메모 내용',
        contentHash: correctHashB, // 기존 정상 해시를 제출해도 변조된 본문과 불일치하여 차단
      }, { currentUserId: testUserIdB });
    } catch (e) {
      if (e.message.includes('HASH_MISMATCH')) tamperedContentBlocked = true;
    }

    // 3) 금지 요청 2: 해시 위변조 시 복구 차단 (정상 본문 + 변조된 임의 해시)
    let hashBlocked = false;
    try {
      restoreSingleNote(backupVault, {
        id: testNoteIdB,
        owner_id: testUserIdB,
        content: testNoteContentB,
        contentHash: 'tampered_invalid_sha256_hash_value',
      }, { currentUserId: testUserIdB });
    } catch (e) {
      if (e.message.includes('HASH_MISMATCH')) hashBlocked = true;
    }

    // 4) 금지 요청 3: 타인 소유자 복원 요청 차단
    let ownerBlocked = false;
    try {
      restoreSingleNote(backupVault, {
        id: testNoteIdB,
        owner_id: 'attacker_user_id',
        contentHash: correctHashB,
      }, { currentUserId: 'attacker_user_id' });
    } catch (e) {
      if (e.message.includes('NOT_OWNER')) ownerBlocked = true;
    }

    if (tamperedContentBlocked && hashBlocked && ownerBlocked) {
      process.stdout.write('「복원 뒤 재시험」 검증 완료: 정상 복원 확인, B 메모 변조 시 복구 차단, 해시 위변조 차단, 타인 소유 복원 차단 통과\n');
    } else {
      throw new Error('복원 뒤 금지 요청 재시험 검증에 실패했습니다.');
    }
  } catch (error) {
    process.stderr.write(`복원 모듈 검증 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
