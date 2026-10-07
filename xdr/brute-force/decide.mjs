/**
 * Jev 분석 모의/조회 함수
 * 애매한 경보에 대해 추가 평가를 수행하여 확신도(0.0 ~ 1.0)를 반환합니다.
 * 만약 환경변수 JEV_API_URL 또는 외부 연동이 설정되지 않거나 응답이 없으면 null을 반환합니다.
 *
 * @param {object} alert
 * @returns {Promise<number | null>}
 */
async function consultJev(alert) {
  // 실제 외부 Jev 엔드포인트가 환경 변수로 지정된 경우 호출 시도
  const jevEndpoint = process.env.JEV_API_URL;
  if (jevEndpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(jevEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: alert.id,
          level: alert.rule?.level,
          description: alert.rule?.description,
          count: alert.data?.count,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const body = await res.json();
        if (typeof body.confidence === 'number') {
          return Math.max(0, Math.min(1, body.confidence));
        }
      }
    } catch {
      // Jev 응답 실패 시 null 반환 (alert로 fallback)
      return null;
    }
  }

  // 외부 Jev 서버가 연결되지 않았을 때의 안전한 fallback:
  // 기본적으로 응답하지 못하는 상황으로 간주하여 null 반환 (요구사항: "Jev 가 응답하지 않으면 alert 로 떨어지게 해 줘")
  return null;
}

/**
 * XDR brute-force decide 함수
 *
 * - 확신도 0.85 이상: block
 * - 확신도 0.5 이상: alert
 * - 확신도 0.5 미만: record
 * - Jev 응답 부재 시: alert (confidence 0.6 등)
 *
 * @param {object} alert
 * @returns {Promise<{action: 'block' | 'alert' | 'record', confidence: number, reason: string}>}
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const description = alert?.rule?.description ?? '';
  const count = parseInt(alert?.data?.count ?? '0', 10);
  const accounts = alert?.data?.accounts;

  // 1. 명확한 공격 (block)
  // 조건: 대량 실패(15건 이상) 또는 다수 계정 비밀번호 스프레이, 또는 규칙 레벨 10 이상
  const isSpray = Boolean(accounts && accounts.split(',').length >= 5) || (level >= 11 && description.includes('계정'));
  const isHighCountFail = count >= 15 || level >= 10;

  if (isSpray) {
    const confidence = 0.95;
    return {
      action: 'block',
      confidence,
      reason: 'password_spraying_across_multiple_accounts',
    };
  }

  if (isHighCountFail) {
    const confidence = 0.92;
    return {
      action: 'block',
      confidence,
      reason: 'short_window_repeated_login_failures',
    };
  }

  // 2. 정상 이벤트 (record)
  // 조건: 로그인 성공, 세션 유지, 정상 화면 접근 등 (규칙 레벨 4 이하)
  if (level <= 4) {
    const confidence = 0.1;
    return {
      action: 'record',
      confidence,
      reason: 'normal_user_activity',
    };
  }

  // 3. 애매한 시도 (alert 후보) -> Jev 에 문의
  const jevConfidence = await consultJev(alert);

  let finalConfidence;
  if (jevConfidence !== null && typeof jevConfidence === 'number') {
    finalConfidence = jevConfidence;
  } else {
    // Jev 가 응답하지 않을 때 기본 alert 범위(0.5 ~ 0.84) 내의 확신도 부여
    finalConfidence = 0.65;
  }

  // 확신도 기준 판정
  let action;
  if (finalConfidence >= 0.85) {
    action = 'block';
  } else if (finalConfidence >= 0.5) {
    action = 'alert';
  } else {
    action = 'record';
  }

  return {
    action,
    confidence: finalConfidence,
    reason: 'short_window_repeated_login_failures',
  };
}
