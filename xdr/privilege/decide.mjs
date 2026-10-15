// xdr/privilege/patterns.json 의 탐지 패턴 상수
const PATTERNS = Object.freeze([
  {
    name: 'admin_group_addition',
    condition: '일반 사용자 계정이 원격 주소에서 관리자 그룹에 비인가 추가되거나 복수의 계정이 일괄적으로 관리자 그룹에 등록되는 경우',
    rationale: 'MITRE ATT&CK T1078 (Valid Accounts) - 정상 계정을 도용하거나 비인가 경로를 통해 계정을 임의로 관리자 그룹에 편입시키는 공격 형태입니다.',
  },
  {
    name: 'unfamiliar_admin_execution',
    condition: '일반 계정이 관리자로 승격된 직후 처음 보는 주소에서 관리자 명령을 실행하거나 타 계정의 권한으로 명령을 수행하는 경우',
    rationale: 'MITRE ATT&CK T1068 (Exploitation for Privilege Escalation) - 획득한 고위험 권한을 이용해 평소 보지 못한 위치나 세션에서 특권 명령을 즉시 실행하는 공격 형태입니다.',
  },
  {
    name: 'off_hours_privilege_abuse',
    condition: '수업 시간이나 일반적인 업무 시간대 밖의 낯선 시각에 관리자 그룹 추가 또는 관리자 명령 실행이 관측되는 경우',
    rationale: 'MITRE ATT&CK T1078 (Valid Accounts) - 감시를 피하기 위해 업무 외 시간에 도용된 계정 권한을 악용하여 관리자 작업을 수행하는 공격 형태입니다.',
  },
]);

/**
 * 경보 내용과 설명, MITRE 태그를 바탕으로 근거 패턴 이름을 판별합니다.
 *
 * @param {object} alert
 * @returns {string} 패턴 이름
 */
function matchPattern(alert) {
  const desc = alert?.rule?.description || '';

  // 1. 업무/수업 외 시각 신호
  if (desc.includes('수업 시간 밖') || desc.includes('업무처럼 보이지 않는 시각') || desc.includes('업무 외')) {
    return 'off_hours_privilege_abuse';
  }

  // 2. 관리자/권한 명령 실행 신호
  if (desc.includes('관리자 명령') || desc.includes('권한 명령') || desc.includes('권한 상승') || desc.includes('다른 계정의 권한') || desc.includes('관리자 권한')) {
    return 'unfamiliar_admin_execution';
  }

  // 3. 관리자 그룹 추가 신호
  if (desc.includes('관리자 그룹') || desc.includes('그룹에 추가') || desc.includes('로컬 그룹') || desc.includes('그룹')) {
    return 'admin_group_addition';
  }

  return 'unfamiliar_admin_execution';
}

/**
 * XDR privilege 단일 판정 함수
 * 외부 파일/패키지/네트워크를 일절 참조하지 않고 메모리 내에서 경보를 단독 계산합니다.
 *
 * 확신도(confidence) 기준:
 * - 0.85 이상: block (명확한 권한 상승 공격: 비인가 관리자 그룹 추가, 권한 명령 실행, 업무 외 권한 남용)
 * - 0.50 이상: alert (애매한 시도: 수업 중 권한 상승 취소, 일반 과제 그룹 추가, 단발성 명령 실패 등)
 * - 0.50 미만: record (정상 계정 활동: 단순 로그인/로그아웃, 세션 조회, 관리 계정 정상 접속)
 *
 * @param {object} alert - Wazuh 형태 가상 경보 객체
 * @returns {Promise<{action: 'block' | 'alert' | 'record', confidence: number, reason: string}>}
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const description = alert?.rule?.description || '';

  // 1. 정상 이벤트 판정 (규칙 수준 4 이하: 단순 로그인/로그아웃, 세션 조회, 화면 열람, 기존 서명/예약 작업)
  if (level <= 4) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: 'normal_system_activity',
    };
  }

  const patternName = matchPattern(alert);

  // 2. 명확한 공격 판정 (규칙 수준 10 이상: 원격 관리자 그룹 추가, 관리자 명령 즉각 실행, 업무 외 시간 권한 탈취 등)
  const isHighSeverity = level >= 10;
  const isExplicitAttack = description.includes('관리자 그룹')
    || description.includes('관리자 명령')
    || description.includes('권한 명령')
    || description.includes('관리자 권한')
    || description.includes('다시 관리자');

  if (isHighSeverity && isExplicitAttack) {
    return {
      action: 'block',
      confidence: 0.95,
      reason: patternName,
    };
  }

  // 3. 애매한 시도 판정 (규칙 수준 5~8: 수업 중 권한 상승 취소, 과제 그룹 추가, 실패 1건, 설명 변경 등)
  return {
    action: 'alert',
    confidence: 0.65,
    reason: patternName,
  };
}
