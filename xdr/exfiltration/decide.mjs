// xdr/exfiltration/patterns.json 의 탐지 패턴 상수
const PATTERNS = Object.freeze([
  {
    name: 'unfamiliar_destination_large_transfer',
    condition: '처음 보는 목적지나 외부 주소로 짧은 시간에 대용량 자료 전송, 전체 복사 또는 연속 반복 전송이 명령 통로를 통해 발생하는 경우',
    rationale: 'MITRE ATT&CK T1041 (Exfiltration Over C2 Channel) - 확립된 명령 제어 통로를 악용하여 대량의 기밀 자료를 처음 보는 외부 서버로 은밀히 빼돌리는 공격 형태입니다.',
  },
  {
    name: 'off_hours_archive_exfiltration',
    condition: '수업 시간이나 정상적인 업무 시간대 밖의 낯선 시각에 압축 파일 또는 자료 묶음이 처음 보는 외부 주소로 반출되는 경우',
    rationale: 'MITRE ATT&CK T1048 (Exfiltration Over Alternative Protocol) - 모니터링이 취약한 업무 외 시간에 대체 프로토콜을 사용하여 압축된 기밀 자료를 외부로 유출하는 공격 형태입니다.',
  },
  {
    name: 'anomalous_port_continuous_transfer',
    condition: '평소 사용하지 않던 비인가 포트나 대체 프로토콜을 통해 다수의 파일 및 압축 자료가 처음 보는 목적지로 연속 전송되는 경우',
    rationale: 'MITRE ATT&CK T1048 (Exfiltration Over Alternative Protocol) - 네트워크 보안 감시를 우회하기 위해 평소에 쓰지 않던 비표준 포트나 대체 프로토콜로 자료를 연속 유출하는 공격 형태입니다.',
  },
]);

/**
 * 경보 내용, 설명, 대상 정보 등을 바탕으로 가장 부합하는 패턴 이름을 판별합니다.
 *
 * @param {object} alert
 * @returns {string} 패턴 이름
 */
function matchPattern(alert) {
  const desc = alert?.rule?.description || '';

  // 1. 비인가/비표준 포트, 다중 목적지, 비정상 연속 전송
  if (desc.includes('포트') || desc.includes('두 곳으로') || desc.includes('올라갔습니다')) {
    return 'anomalous_port_continuous_transfer';
  }

  // 2. 업무/수업 외 시각 또는 압축 파일 반출
  if (desc.includes('수업 시간 밖') || desc.includes('업무 시간 밖') || desc.includes('압축 파일')) {
    return 'off_hours_archive_exfiltration';
  }

  // 3. 처음 보는 목적지 대용량 전송 또는 명령 통로 유출
  return 'unfamiliar_destination_large_transfer';
}

/**
 * XDR exfiltration 단일 판정 함수
 * 외부 파일/패키지/네트워크를 일절 참조하지 않고 메모리 내에서 경보를 단독 계산합니다.
 *
 * 확신도(confidence) 기준:
 * - 0.85 이상: block (명확한 자료 유출 공격)
 * - 0.50 이상: alert (애매한 대용량/비인가 전송 시도)
 * - 0.50 미만: record (정상적인 파일 및 세션 활동)
 *
 * @param {object} alert - Wazuh 형태 가상 경보 객체
 * @returns {Promise<{action: 'block' | 'alert' | 'record', confidence: number, reason: string}>}
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const description = alert?.rule?.description || '';
  const bytes = parseInt(alert?.data?.bytes || '0', 10);
  const files = parseInt(alert?.data?.files || '0', 10);
  const count = parseInt(alert?.data?.count || '0', 10);

  // 1. 정상 이벤트 판정 (규칙 수준 4 이하: 단순 메모 열람/저장, 공지 확인, 세션 체크 등)
  if (level <= 4) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: 'normal_transfer_activity',
    };
  }

  const patternName = matchPattern(alert);

  // 2. 명확한 공격 판정 (규칙 수준 10 이상: 10분 내 200건, 대용량 반복 전송, 업무외 반출, 전체 복사 등)
  const isHighSeverity = level >= 10;
  const isBulkOrSevere = bytes >= 50000000
    || files >= 100
    || count >= 5
    || description.includes('전체')
    || description.includes('연속');

  if (isHighSeverity && isBulkOrSevere) {
    return {
      action: 'block',
      confidence: 0.95,
      reason: patternName,
    };
  }

  // 3. 애매한 시도 판정 (규칙 수준 5~8: 단발성 파일 전송, 작은 백업 시도, 실패한 전송 등)
  return {
    action: 'alert',
    confidence: 0.65,
    reason: patternName,
  };
}
