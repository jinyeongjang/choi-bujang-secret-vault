/**
 * Jev 분석 모의/조회 함수
 * 애매한 경보에 대해 추가 평가를 수행하여 확신도(0.0 ~ 1.0)를 반환합니다.
 * 만약 환경변수 JEV_API_URL이 설정되지 않거나 응답하지 않으면 null을 반환합니다.
 *
 * @param {object} alert
 * @returns {Promise<number | null>}
 */
async function consultJev(alert) {
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
          url: alert.data?.url,
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
      return null;
    }
  }
  return null;
}

/**
 * XDR web-injection decide 함수
 *
 * - 확신도 0.85 이상: block
 * - 확신도 0.5 이상: alert
 * - 확신도 0.5 미만: record
 * - Jev 응답 부재 시: alert (confidence 0.65)
 *
 * @param {object} alert
 * @returns {Promise<{action: 'block' | 'alert' | 'record', confidence: number, reason: string}>}
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const description = alert?.rule?.description ?? '';
  const url = alert?.data?.url ?? '';
  const count = parseInt(alert?.data?.count ?? '0', 10);

  // 패턴 매칭 헬퍼
  const isSql = description.includes('SQL') || url.includes('sql') || description.includes('조회');
  const isScript = description.includes('스크립트') || url.includes('script');
  const isPath = description.includes('경로') || url.includes('path') || description.includes('이탈');

  let patternName = 'sql_injection_attempt';
  if (isScript) {
    patternName = 'cross_site_scripting_attempt';
  } else if (isPath) {
    patternName = 'path_traversal_attempt';
  }

  // 1. 명확한 공격 (block)
  // 조건: 반복 횟수가 높고(count >= 8) 규칙 레벨이 10 이상인 주입 시도
  const isHighFrequencyInjection = count >= 8 && level >= 10;
  if (isHighFrequencyInjection) {
    const confidence = 0.95;
    return {
      action: 'block',
      confidence,
      reason: patternName,
    };
  }

  // 2. 정상 이벤트 (record)
  // 조건: 규칙 레벨 4 이하 (단순 조회, 화면 접근, 로그아웃 등)
  if (level <= 4) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: 'normal_web_request',
    };
  }

  // 3. 애매한 시도 (alert 후보: level 5~8, 단발성 검색어에 포함된 단어 등)
  const jevConfidence = await consultJev(alert);

  let finalConfidence;
  if (jevConfidence !== null && typeof jevConfidence === 'number') {
    finalConfidence = jevConfidence;
  } else {
    // Jev 응답 부재 시 alert 기준(0.5 ~ 0.84) 범위의 0.65 부여
    finalConfidence = 0.65;
  }

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
    reason: patternName,
  };
}
