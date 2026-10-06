// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (config.step < 1 || config.step > 4) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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

  // 2~4단계 공격 점검
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

  return results;
}

