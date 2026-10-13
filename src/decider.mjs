// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required']);

/**
 * 엔진이 검증해 넘긴 가상 접속 신호(signals) 및 최근 사건(recentEvents) 입력을 검사합니다.
 * 출처(source)를 구분하며, 누락되거나 출처가 불명확한 경우 임의의 정상값('local', 'usual', 14 등)으로 채우지 않습니다.
 */
function parseConnectionSignals(request) {
  const signals = request?.signals;
  const recentEvents = Array.isArray(request?.recentEvents) ? request.recentEvents : null;

  // 가상 접속 정보 출처 구분 (예: 'judge_fixture', 'none' 등)
  const source = typeof signals?.source === 'string' && signals.source.trim() ? signals.source : null;

  // 출처가 명확한 경우에만 필드값을 참조하며, 없거나 불명확해도 임의의 정상값으로 채우지 않음
  const region = source && typeof signals?.region === 'string' ? signals.region : null;
  const network = source && typeof signals?.network === 'string' ? signals.network : null;
  const hour = source && typeof signals?.hour === 'number' && Number.isInteger(signals.hour) && signals.hour >= 0 && signals.hour <= 23
    ? signals.hour
    : null;

  return {
    source,
    region,
    network,
    hour,
    recentEvents,
  };
}

export async function decide(request) {
  // 엔진이 검증해 넘긴 가상 접속 정보의 출처 및 필드 검사
  const context = parseConnectionSignals(request);

  // 1. 기존 기기 등록 규칙 검증: 미등록 기기 차단
  if (request?.deviceRegistered !== true) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'device_not_registered',
      ruleIds: ['device_registered'],
    };
  }

  // 2. 복합 이상 접속 검사: 평소와 다른 시각 + 낯선 네트워크 + 대량/위험 자료 열람 사건
  // 지역(region) 단독 조건으로 영구 차단하지 않고 복합 이상 징후 발생 시 추가 확인(step_up) 요구
  const isUnusualHour = context.hour !== null && (context.hour < 6 || context.hour >= 22);
  const isUnusualNetwork = context.network !== null && context.network !== 'usual';
  const hasBurstActivity = Array.isArray(context.recentEvents) && context.recentEvents.some(
    e => e.kind === 'risk_signal' || (typeof e.count === 'number' && e.count >= 10),
  );

  const isSuspicious = isUnusualHour && isUnusualNetwork && hasBurstActivity;

  if (isSuspicious) {
    const isStepUpVerified = request.stepUp?.verified === true
      && typeof request.stepUp.authAgeSeconds === 'number'
      && request.stepUp.authAgeSeconds <= 900;

    if (!isStepUpVerified) {
      return {
        schema: 'aleph.decision.v1',
        requestId: request.requestId,
        decision: 'step_up',
        reasonCode: 'step_up_required',
        ruleIds: ['step_up_required'],
      };
    }

    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'allow',
      reasonCode: 'approved',
      ruleIds: ['device_registered', 'step_up_required'],
    };
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered'],
  };
}


