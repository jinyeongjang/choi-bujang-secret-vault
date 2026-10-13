// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 이 기본 응답은 모든 요청을 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered', 'step_up_required', 'zone_isolation', 'zone_rules']);

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

/**
 * 엔진이 확인한 서비스·메서드·정확한 경로·라우트가 인가된 구역에 부합하는지 엄격히 검사합니다.
 * - 반 공지나 강사 자료에 대한 쓰기(POST·PUT·PATCH·DELETE)는 누구에게나 거부
 * - 메모 전체 목록처럼 여러 사람의 자료를 한꺼번에 여는 경로(/notes 목록, :id 없는 라우트)는 거부
 * - 메모 한 건(/notes/:id)의 주인 비교는 API가 하므로 판정기는 단건 연산을 허용
 * - 기능 경로, 쿼리 기능 선택, 알 수 없는 구역은 거부
 */
function validateZoneAccess(request) {
  const service = typeof request?.service === 'string' ? request.service.toLowerCase() : '';
  const method = typeof request?.method === 'string' ? request.method.toUpperCase() : '';
  const path = typeof request?.path === 'string' ? request.path : '';
  const route = typeof request?.route === 'string' ? request.route : '';
  const queryLength = typeof request?.queryLength === 'number' ? request.queryLength : 0;

  // 1. 쿼리로 기능을 선택하지 않고 자료 ID만 지정 (queryLength > 0 거부)
  if (queryLength > 0) {
    return false;
  }

  // 2. 상위 디렉터리 탐색(path traversal) 차단
  if (path.includes('..') || route.includes('..')) {
    return false;
  }

  // 3. :id와 같은 깊이에 export, admin 등 기능 경로를 두지 않음
  if (/\/(?:export|import|actions?|admin|functions?)(?:\/|$)/i.test(path)
      || /\/(?:export|import|actions?|admin|functions?)(?:\/|$)/i.test(route)) {
    return false;
  }

  const cleanPath = path.replace(/^\/api/, '').replace(/\/+$/, '');

  // 4. 반 공지나 강사 자료 구역 판별: 쓰기는 누구에게나 전면 거부
  const isNoticeOrMaterial = /notice|announcement|material|instructor|lecture|lesson|course|class|bulletin|board/i.test(service)
    || /notice|announcement|material|instructor|lecture|lesson|course|class|bulletin|board/i.test(cleanPath)
    || /notice|announcement|material|instructor|lecture|lesson|course|class|bulletin|board/i.test(route);

  if (isNoticeOrMaterial) {
    // 판정기는 공지·강사 자료 쓰기(POST, PUT, PATCH, DELETE)를 누구에게나 거부
    if (['PUT', 'POST', 'PATCH', 'DELETE'].includes(method) || method !== 'GET') {
      return false;
    }
    // 읽기(GET)만 허용
    return method === 'GET';
  }

  // 5. 메모 전체 목록 경로 판별: 여러 사람의 자료를 한꺼번에 여는 경로는 무조건 거부
  // - 경로가 컬렉션 루트(/notes)인 경우
  // - 라우트에 :id가 없는 경우 (예: GET /notes)
  // - 경로에 all, list, bulk 등이 지정된 경우
  const isCollectionPath = cleanPath === '/notes' || cleanPath === ''
    || !route.includes(':id')
    || /\/notes\/(?:all|list|bulk|batch|every|entire)(?:\/|$)/i.test(cleanPath);

  if (isCollectionPath) {
    return false;
  }

  // 6. 메모 한 건(/notes/:id) 경로 판별: 단건 연산(GET, PUT, DELETE) 허용 (주인 비교는 API가 수행)
  const isSingleNote = (service === 'notes' || cleanPath.startsWith('/notes') || route.includes('/notes/:id'))
    && /^\/notes\/[^/?#]+$/i.test(cleanPath);

  if (isSingleNote) {
    return ['GET', 'PUT', 'DELETE'].includes(method);
  }

  // 7. 그 외 모든 서비스 및 경로는 미인가 다른 구역(Other Zone)이므로 거부!
  return false;
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

  // 2. 엔진이 확인한 사용자·기기 검증 (유효한 주체 ID 및 16자리 소문자 16진수 기기 ID)
  const isValidSubject = typeof request?.subjectId === 'string' && request.subjectId.trim().length > 0;
  const isValidDevice = typeof request?.deviceId === 'string' && /^[0-9a-f]{16}$/i.test(request.deviceId);
  if (!isValidSubject || !isValidDevice) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'identity_missing',
      ruleIds: ['zone_isolation', 'zone_rules'],
    };
  }

  // 3. 구역 규칙 검증: 타인 메모 차단, 공지 수정 차단, 다른 구역(Other Zone) 및 알 수 없는 경로 차단
  if (!validateZoneAccess(request)) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_access_denied',
      ruleIds: ['zone_isolation', 'zone_rules'],
    };
  }

  // 7. 복합 이상 접속 검사 (기존 7단계 규칙 유지): 평소와 다른 시각 + 낯선 네트워크 + 대량/위험 자료 열람 사건
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
      ruleIds: ['device_registered', 'step_up_required', 'zone_isolation', 'zone_rules'],
    };
  }

  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: 'allow',
    reasonCode: 'approved',
    ruleIds: ['device_registered', 'zone_isolation', 'zone_rules'],
  };
}


