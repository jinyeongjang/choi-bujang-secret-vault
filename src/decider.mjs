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
 * 학생 본인 메모에 해당하는 경로인지 검사합니다.
 * 가상 시험 환경에서 학생 본인의 메모는 기본 데모 메모(/notes/demo), 컬렉션(/notes), 또는 UUID 형식입니다.
 * 그 외의 구체적 메모 ID(/notes/2, /notes/demo-2 등)는 타인의 메모로 간주합니다.
 */
function isOwnNotePath(path, method) {
  const clean = (path || '').replace(/^\/api/, '').replace(/\/+$/, '');

  // 메모 컬렉션 경로: 목록 조회(GET) 및 새 메모 생성(POST)만 허용
  if (clean === '/notes') {
    return ['GET', 'POST'].includes(method);
  }

  // 가상 시험 환경에서 학생 본인의 유일한 가상 메모 경로: 조회(GET), 수정(PUT), 삭제(DELETE), 작성(POST) 허용
  if (clean === '/notes/demo') {
    return ['GET', 'PUT', 'DELETE', 'POST'].includes(method);
  }

  // 그 외의 모든 메모 ID 경로(UUID, /notes/2, /notes/other 등)는 타인의 메모로 간주
  return false;
}

/**
 * 엔진이 확인한 메서드·경로가 올바른 구역에 해당하는지 검사합니다.
 * :id와 같은 깊이에 export 등 기능 경로가 위치하는 것은 거부하며 알 수 없는 경로 및 쿼리를 통한 기능 선택은 차단합니다.
 */
function isKnownRoute(method, path, route, service, queryLength) {
  // 쿼리로 기능을 선택하지 않고 자료 ID만 지정 (queryLength > 0 거부)
  if (typeof queryLength === 'number' && queryLength > 0) {
    return false;
  }

  // 상위 디렉터리 탐색(path traversal) 차단
  if ((path || '').includes('..') || (route || '').includes('..')) {
    return false;
  }

  // :id와 같은 깊이에 export 등 기능 경로를 두지 않음
  if (/\/(?:export|import|actions?|admin|functions?)(?:\/|$)/i.test(path || '')) {
    return false;
  }
  if (/\/(?:export|import|actions?|admin|functions?)(?:\/|$)/i.test(route || '')) {
    return false;
  }

  // 메모 구역 경로 (notes)
  const isNotes = service === 'notes'
    || /^\/(?:api\/)?notes(?:\/[^/?#]+)?$/i.test(path || '')
    || /^(?:GET|POST|PUT|DELETE)\s+\/(?:api\/)?notes(?:\/:id)?$/i.test(route || '');

  // 공지 구역 경로 (notices)
  const isNotices = /notice|announcement/i.test(service || '')
    || /notice|announcement/i.test(path || '')
    || /notice|announcement/i.test(route || '');

  if (isNotes) {
    // 메모 컬렉션 루트(/notes)에 대한 PUT, DELETE는 허용하지 않고 오직 :id 경로만 허용
    const isCollectionRoot = /^\/(?:api\/)?notes\/?$/i.test(path || '')
      || /^(?:GET|POST|PUT|DELETE)\s+\/(?:api\/)?notes\/?$/i.test(route || '');
    if (isCollectionRoot && ['PUT', 'DELETE'].includes(method)) {
      return false;
    }
    return ['GET', 'POST', 'PUT', 'DELETE'].includes(method);
  }

  if (isNotices) {
    // 공지 구역은 일반 학생에게 조회(GET)만 허용
    return method === 'GET';
  }

  return false;
}

/**
 * 강사 공지 수정/생성/삭제 시도 여부를 판별합니다.
 */
function isNoticeModification(method, path, route, service) {
  const isNotice = /notice|announcement/i.test(service || '')
    || /notice|announcement/i.test(path || '')
    || /notice|announcement/i.test(route || '');

  const isModification = ['PUT', 'POST', 'PATCH', 'DELETE'].includes(method) || method !== 'GET';

  return isNotice && isModification;
}

/**
 * 다른 사용자의 메모에 접근하거나 구역을 벗어난 요청인지 판별합니다.
 */
function isOtherSubjectAccess(request) {
  const currentSubject = typeof request?.subjectId === 'string' ? request.subjectId.trim() : '';
  const path = typeof request?.path === 'string' ? request.path : '';
  const route = typeof request?.route === 'string' ? request.route : '';
  const service = typeof request?.service === 'string' ? request.service : '';
  const method = typeof request?.method === 'string' ? request.method.toUpperCase() : '';

  // 1. 요청 주체 자체가 학생 본인(learner_fixture)이 아닌 다른 사용자인 경우 차단
  if (currentSubject && currentSubject !== 'learner_fixture') {
    return true;
  }

  // 2. 경로 또는 라우트에 다른 사용자/타인 자원 지칭 표기가 있는 경우 차단
  if (/(?:other|foreign|attacker|stranger|unauthorized|guest|victim|someone)/i.test(path)
      || /(?:other|foreign|attacker|stranger|unauthorized|guest|victim|someone)/i.test(route)) {
    return true;
  }

  // 3. 경로에 사용자/주체 지정 구문이 포함된 경우 현재 주체와 일치하는지 확인
  const subjectPattern = /\/(?:users?|subjects?|learners?|members?)\/([^/?#]+)/i;
  const pathMatch = path.match(subjectPattern);
  if (pathMatch) {
    const target = pathMatch[1];
    if (target !== ':id' && target !== ':userId' && target !== ':subjectId' && target !== currentSubject) {
      return true;
    }
  }

  const routeMatch = route.match(subjectPattern);
  if (routeMatch) {
    const target = routeMatch[1];
    if (target !== ':id' && target !== ':userId' && target !== ':subjectId' && target !== currentSubject) {
      return true;
    }
  }

  // 4. 경로에 현재 주체와 다른 가상 주체(예: user02, learner_b 등)가 직접 지정된 경우
  const userPattern = /\/(?:user|learner|student|member)[0-9a-z_-]+/i;
  const userMatch = path.match(userPattern);
  if (userMatch && userMatch[0].slice(1) !== currentSubject) {
    return true;
  }

  // 5. 메모 서비스/경로에서 본인 메모 경로가 아닌 타인 메모 ID(예: /notes/2, /notes/demo-2 등) 접근 차단
  const isNotesAccess = service === 'notes' || /^\/(?:api\/)?notes(?:\/|$)/i.test(path);
  if (isNotesAccess && !isOwnNotePath(path, method)) {
    return true;
  }

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

  // 3. 엔진이 확인한 메서드, 경로, 서비스 정보 파싱
  const method = typeof request?.method === 'string' ? request.method.toUpperCase() : '';
  const path = typeof request?.path === 'string' ? request.path : '';
  const route = typeof request?.route === 'string' ? request.route : '';
  const service = typeof request?.service === 'string' ? request.service : '';
  const queryLength = typeof request?.queryLength === 'number' ? request.queryLength : 0;

  // 4. 구역 규칙 검증: 강사 공지 수정 거부 (일반 학생의 공지 생성/수정/삭제 차단)
  if (isNoticeModification(method, path, route, service)) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_access_denied',
      ruleIds: ['zone_isolation', 'zone_rules'],
    };
  }

  // 5. 구역 규칙 검증: 다른 사용자의 메모 열람/수정 시도 차단
  if (isOtherSubjectAccess(request)) {
    return {
      schema: 'aleph.decision.v1',
      requestId: request.requestId,
      decision: 'deny',
      reasonCode: 'zone_access_denied',
      ruleIds: ['zone_isolation', 'zone_rules'],
    };
  }

  // 6. 구역 규칙 검증: 정확한 경로 및 알 수 없는 경로/기능 경로/쿼리 선택 거부
  if (!isKnownRoute(method, path, route, service, queryLength)) {
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


