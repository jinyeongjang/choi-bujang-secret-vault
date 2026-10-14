// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (config.step < 1 || config.step > 11) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');

  if (config.step === 1) {
    const response = await fetch(new URL('/data.json', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    let visible = false;
    if (response.ok) {
      try {
        const data = await response.json();
        visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
          && data.notes.length > 0;
      } catch {
        // A non-JSON response is a failed check, not a successful deployment.
      }
    }
    return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
      observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
  }

  // 2~5단계 공격 점검
  const results = [];

  let staticObserved = '요청 실패';
  try {
    const response = await fetch(new URL('/data.json', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) {
      staticObserved = '공개 data.json이 제거되어 가상 메모 확인 표시가 노출되지 않음 (HTTP 404)';
    } else if (response.ok) {
      const data = await response.json();
      const hasMarker = data?.sampleMarker === config.sampleMarker;
      staticObserved = hasMarker ? '공개 data.json에 가상 메모 확인 표시가 남아 있음' : '공개 data.json에서 가상 메모 확인 표시가 보이지 않음';
    } else {
      staticObserved = `공개 data.json 응답 코드 (HTTP ${response.status})`;
    }
  } catch (err) {
    staticObserved = `공개 data.json 요청 예외 (${err.message})`;
  }
  results.push({
    attackId: 'anonymous_static_read',
    expected: '비로그인 정적 data.json 요청에서 가상 메모 확인 표시가 노출되지 않음',
    observed: staticObserved,
  });

  let apiObserved = '요청 실패';
  try {
    const response = await fetch(new URL('/api/notes', app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (config.step >= 3) {
      if (response.status === 401) {
        apiObserved = '비로그인 요청이 정상 거부됨 (HTTP 401)';
      } else if (response.ok) {
        apiObserved = '비로그인 요청에서 가상 메모가 노출됨 (미보호)';
      } else {
        apiObserved = `비로그인 요청 응답 (HTTP ${response.status})`;
      }
    } else {
      if (response.ok) {
        const data = await response.json();
        const visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data?.notes) && data.notes.length > 0;
        apiObserved = visible ? '비로그인 공개 API 요청에서 가상 메모 확인 표시가 보임 (공개 주소 약점)' : '비로그인 공개 API 요청에서 메모 확인 표시가 없음';
      } else {
        apiObserved = `비로그인 공개 API 요청 실패 (HTTP ${response.status})`;
      }
    }
  } catch (err) {
    apiObserved = `비로그인 공개 API 요청 예외 (${err.message})`;
  }
  results.push({
    attackId: 'anonymous_api_read',
    expected: config.step >= 3 ? '비로그인 요청 시 자료 없이 401 거부' : '비로그인 공개 API(/api/notes)에서 가상 메모 확인',
    observed: apiObserved,
  });

  if (config.step >= 6) {
    results.push({
      attackId: 'unregistered_device_access',
      expected: '미등록 기기의 가상 자료실 접근 차단 (심판 점검)',
      observed: '미실행 (심판 원격 점검 대기)',
    });
  }

  if (config.step >= 7) {
    results.push({
      attackId: 'suspicious_access_step_up',
      expected: '복합 이상 접속 시 추가 확인 요구 및 재인증 전 자료 차단',
      observed: '미실행 (재로그인 시각 계약 부재로 가상 사건 규칙 시험만 수행, 실제 자료 차단은 미실행)',
    });
  }

  if (config.step >= 8) {
    results.push({
      attackId: 'unauthorized_zone_modification',
      expected: '공지 구역 수정 및 알 수 없는 경로 접근 차단 (심판 점검)',
      observed: '미실행 (심판 원격 점검 대기)',
    });
  }

  if (config.step >= 9) {
    results.push({
      attackId: 'burst_read_revocation',
      expected: '10분 구간 내 120건 초과 폭주 조회 시 확인된 기기 회수 제안 (심판 점검)',
      observed: '미실행 (가상 사건 탐지 시험 npm run detect:test 통과, 실제 접속 회수 집행은 심판 원격 점검 대기)',
    });
  }

  if (config.step >= 10) {
    const restorePath = config.restoreRoute ? config.restoreRoute.replace(/^POST\s+/i, '') : '/api/notes/restore';

    // 1) 복구 뒤 정상 요청 재시험 (정상 복원 경로 및 사전 점검): OPTIONS 사전 요청 204 및 서비스 200 정상 확인
    let normalObserved = '요청 실패';
    try {
      const optResponse = await fetch(new URL(restorePath, app), {
        method: 'OPTIONS',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (optResponse.status === 204 || optResponse.status === 200) {
        normalObserved = `복구 뒤 복원 경로 사전 요청이 정상 처리됨 (HTTP ${optResponse.status})`;
      } else {
        const svcResponse = await fetch(app, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000) });
        normalObserved = svcResponse.ok ? `복구 뒤 서비스가 정상 동작함 (HTTP ${svcResponse.status})` : `복구 뒤 응답 이상 (HTTP ${svcResponse.status})`;
      }
    } catch (err) {
      normalObserved = `복구 뒤 정상 요청 예외 (${err.message})`;
    }
    results.push({
      attackId: 'post_restore_normal_access',
      expected: '복원 경로(/api/notes/restore) 정상 응답 확인 (HTTP 204 또는 200)',
      observed: normalObserved,
    });

    // 2) 복구 뒤 금지 요청 재시험: 비인가 복원 및 변조 해시 복원 요청 차단 점검
    let forbiddenObserved = '요청 실패';
    try {
      const response = await fetch(new URL(restorePath, app), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          id: 'b1111111-1111-1111-1111-111111111111',
          content: '변조된 본문 내용',
          contentHash: 'invalid_tampered_hash_value',
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401 || response.status === 400 || response.status === 403) {
        forbiddenObserved = `비인가 및 해시 변조 복원 요청이 정상 차단됨 (HTTP ${response.status})`;
      } else {
        forbiddenObserved = `금지 요청 응답 이상 (HTTP ${response.status})`;
      }
    } catch (err) {
      forbiddenObserved = `금지 요청 예외 (${err.message})`;
    }
    results.push({
      attackId: 'post_restore_forbidden_access',
      expected: '비인가 또는 변조된 복원 요청 시 자료 없이 거부 (HTTP 401/400/403)',
      observed: forbiddenObserved,
    });
  }

  if (config.step >= 11) {
    results.push({
      attackId: 'unapproved_device_access',
      expected: '미승인 기기의 보호 자료실 열람 차단 및 서버 기기 승인 확인 후 정상 열람',
      observed: '미실행 (심판 원격 점검 대기)',
    });
  }

  return results;
}

