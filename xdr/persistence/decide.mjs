// xdr/persistence/patterns.json 의 탐지 패턴 상수
const PATTERNS = Object.freeze([
  {
    name: 'unsigned_service_creation',
    condition: '서명되지 않은 새 서비스가 등록되거나 기존 서비스의 실행 파일이 임시 폴더(Temp) 등 비정상 위치의 미서명 바이너리로 변경되는 경우',
    rationale: 'MITRE ATT&CK T1543 (Create or Modify System Process) - 시스템 재부팅 시 지속성을 확보하기 위해 서명 없는 악성 실행 파일을 새 서비스로 등록하거나 변경하는 공격 형태입니다.',
  },
  {
    name: 'unfamiliar_scheduled_task',
    condition: '처음 보는 예약 작업이 임의 문자열 이름으로 등록되거나 비인가 시간대에 임시 폴더의 실행 파일을 주기적으로 실행하도록 등록된 경우',
    rationale: 'MITRE ATT&CK T1053 (Scheduled Task/Job) - 작업 스케줄러를 통해 시스템 재시작이나 특정 주기에 악성 프로그램을 자동 실행시켜 지속성을 유지하려는 공격 형태입니다.',
  },
  {
    name: 'startup_folder_modification',
    condition: '사용자 또는 시스템 시작(Startup) 폴더에 평소 목록에 없거나 임시 폴더의 프로그램을 가리키는 비인가 실행 파일이 추가되는 경우',
    rationale: 'MITRE ATT&CK T1543 (Create or Modify System Process) - 사용자 로그인 시 악성 프로세스가 자동으로 구동되도록 시작 폴더에 지속성 프로그램을 심어두는 공격 형태입니다.',
  },
]);

/**
 * 경보 내용과 MITRE ATT&CK 태그를 바탕으로 근거 패턴 이름을 판별합니다.
 *
 * @param {object} alert
 * @returns {string} 패턴 이름
 */
function matchPattern(alert) {
  const desc = alert?.rule?.description || '';
  const mitre = alert?.rule?.mitre || [];
  const path = alert?.data?.path || '';

  if (desc.includes('시작 폴더') || desc.includes('시작 항목') || desc.includes('시작 프로그램') || path.includes('Startup') || desc.includes('Startup')) {
    return 'startup_folder_modification';
  }
  if (desc.includes('예약 작업') || desc.includes('스케줄') || mitre.includes('T1053')) {
    return 'unfamiliar_scheduled_task';
  }
  if (desc.includes('서비스') || mitre.includes('T1543')) {
    return 'unsigned_service_creation';
  }
  return 'unsigned_service_creation';
}

/**
 * XDR persistence 단일 판정 함수
 * 외부 파일/패키지/네트워크를 일절 참조하지 않고 메모리 내에서 경보를 단독 계산합니다.
 *
 * 확신도(confidence) 기준:
 * - 0.85 이상: block (명확한 지속성 공격: 서명 없는 서비스, 악성 예약 작업, 시작 폴더 변조)
 * - 0.50 이상: alert (애매한 시도: 수업 중 작업 생성, 서명 미확인, 단순 설명 변경 등)
 * - 0.50 미만: record (정상 시스템 및 사용자 활동)
 *
 * @param {object} alert - Wazuh 형태 가상 경보 객체
 * @returns {Promise<{action: 'block' | 'alert' | 'record', confidence: number, reason: string}>}
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const description = alert?.rule?.description || '';
  const path = alert?.data?.path || '';
  const count = parseInt(alert?.data?.count || '0', 10);

  // 1. 정상 이벤트 판정 (규칙 수준 4 이하: 단순 로그인/로그아웃, 화면 열람, 기존 서명 서비스 등)
  if (level <= 4) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: 'normal_system_activity',
    };
  }

  const patternName = matchPattern(alert);

  // 2. 명확한 공격 판정 (규칙 수준 10 이상: 미서명 서비스 임시폴더 지정, 미인가 예약작업, 시작폴더 추가 등)
  const isSuspiciousPath = path.toLowerCase().includes('temp') || path.toLowerCase().includes('startup');
  const isHighSeverity = level >= 10;
  const isRepeatedOrExplicit = count >= 3
    || isSuspiciousPath
    || description.includes('서명 없는')
    || description.includes('다시 켜도 남도록')
    || description.includes('임시 폴더');

  if (isHighSeverity && isRepeatedOrExplicit) {
    return {
      action: 'block',
      confidence: 0.95,
      reason: patternName,
    };
  }

  // 3. 애매한 시도 판정 (규칙 수준 5~8: 수업 도구, 서명 미확인, 수업 중 예약 작업 등)
  return {
    action: 'alert',
    confidence: 0.65,
    reason: patternName,
  };
}
