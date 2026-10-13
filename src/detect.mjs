// 9단계에서 학생이 채우는 탐지 함수입니다. 이 기본값은 어떤 접속도 회수하지 않습니다.
// 반 엔진이 검증한 사건만 전달해야 하며, 브라우저가 보낸 사용자 번호는 받지 않습니다.

const TEN_MINUTES_MS = 10 * 60 * 1000;
const BURST_READ_THRESHOLD = 120;

/**
 * 가상 사건에서 가명 사용자·기기·요청 종류·판정·네트워크 및 시각 정보만 추출합니다.
 * 메모 내용(body, content), 인증 토큰(token), 실명(name, realName) 등 민감 정보는
 * 저장하거나 출력하지 않고 안전하게 배제합니다.
 */
function sanitizeEvent(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  // 1. 가명 사용자 (검증된 identity.sub 또는 subjectId 가명 식별자만 참조)
  const subject = typeof event.identity?.sub === 'string' && event.identity.sub.trim()
    ? event.identity.sub.trim()
    : typeof event.subjectId === 'string' && event.subjectId.trim()
      ? event.subjectId.trim()
      : null;

  // 2. 기기 (deviceId 또는 device 식별자)
  const device = typeof event.deviceId === 'string' && event.deviceId.trim()
    ? event.deviceId.trim()
    : typeof event.device === 'string' && event.device.trim()
      ? event.device.trim()
      : null;

  // 3. 요청 종류 (method, kind 또는 action)
  const requestType = typeof event.method === 'string' && event.method.trim()
    ? event.method.trim().toUpperCase()
    : typeof event.action === 'string' && event.action.trim()
      ? event.action.trim()
      : typeof event.kind === 'string' && event.kind.trim()
        ? event.kind.trim()
        : null;

  // 4. 판정 (decision 또는 result)
  const decision = typeof event.decision === 'string' && event.decision.trim()
    ? event.decision.trim()
    : typeof event.result === 'string' && event.result.trim()
      ? event.result.trim()
      : null;

  // 5. 네트워크 및 지역 신호 (지역 단독 판정 방지 및 낯선 네트워크 확인용)
  const network = typeof event.network === 'string' && event.network.trim()
    ? event.network.trim()
    : typeof event.signals?.network === 'string' && event.signals.network.trim()
      ? event.signals.network.trim()
      : null;

  const region = typeof event.region === 'string' && event.region.trim()
    ? event.region.trim()
    : typeof event.signals?.region === 'string' && event.signals.region.trim()
      ? event.signals.region.trim()
      : null;

  // 시각 (구간 계산용 ISO 시각)
  const at = typeof event.at === 'string' && event.at.trim()
    ? event.at.trim()
    : typeof event.timestamp === 'string' && event.timestamp.trim()
      ? event.timestamp.trim()
      : null;

  return {
    subject,
    device,
    requestType,
    decision,
    network,
    region,
    at,
  };
}

export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');

  // 제공된 가상 사건에서 필요한 속성만 안전하게 읽음 (메모 내용·토큰·실명은 저장/출력하지 않음)
  const cleanedEvents = events.map(sanitizeEvent).filter(Boolean);

  // 사용자(subject)별 GET 조회 사건 분류
  const readsByUser = new Map();
  for (const ev of cleanedEvents) {
    if (!ev.subject || ev.requestType !== 'GET' || !ev.at) continue;
    const time = new Date(ev.at).getTime();
    if (Number.isNaN(time)) continue;

    if (!readsByUser.has(ev.subject)) {
      readsByUser.set(ev.subject, []);
    }
    readsByUser.get(ev.subject).push({ ...ev, time });
  }

  // 사용자별 10분 구간 내 다량 조회(120건 초과) 및 네트워크 이상 복합 검사
  // 주의: 지역(region) 단독으로는 확정하지 않음
  for (const [subject, userReads] of readsByUser.entries()) {
    if (userReads.length <= BURST_READ_THRESHOLD) {
      continue;
    }

    userReads.sort((a, b) => a.time - b.time);

    for (let i = 0; i <= userReads.length - (BURST_READ_THRESHOLD + 1); i++) {
      const windowEndIndex = i + BURST_READ_THRESHOLD;
      const duration = userReads[windowEndIndex].time - userReads[i].time;

      if (duration <= TEN_MINUTES_MS) {
        const windowSlice = userReads.slice(i, windowEndIndex + 1);
        const hasExplicitNetwork = windowSlice.some(e => e.network !== null);
        const hasUnusualNetwork = windowSlice.some(e => e.network !== null && e.network !== 'usual');

        // 네트워크 정보가 없는 가상 연습 사건이거나, 평소와 다른 네트워크가 함께 나타날 때만 의심 확정
        if (!hasExplicitNetwork || hasUnusualNetwork) {
          // 확인된 가상 기기 한 개로 대상을 한정 (사건에 기기 정보가 있는 경우)
          const targetDevice = windowSlice.find(e => typeof e.device === 'string' && e.device.trim())?.device;

          const proposal = {
            action: 'propose_revocation',
            reasonCode: 'burst_read',
            subject,
          };

          if (targetDevice) {
            proposal.device = targetDevice;
          }

          return proposal;
        }

      }
    }
  }

  // 정상 사건 및 임계치 이하 요청은 그대로 관찰 유지
  return { action: 'observe' };
}


