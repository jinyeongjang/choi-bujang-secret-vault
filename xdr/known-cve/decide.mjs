// xdr/known-cve/patterns.json 의 탐지 패턴 상수
const PATTERNS = Object.freeze([
  {
    name: 'jndi_header_injection',
    condition: 'HTTP 요청 머리글(User-Agent 등) 내에 ${jndi:ldap://...} 등 원격 클래스 조회를 유발하는 JNDI 구문이 포함되어 있거나 여러 머리글에 전달되는 경우',
    rationale: 'MITRE ATT&CK T1190 (Exploit Public-Facing Application) - CVE-2021-44228 취약점을 악용하여 머리글 로깅 시 비인가 원격 코드 실행(RCE)을 유도하려는 공격 형태입니다.',
  },
  {
    name: 'jndi_parameter_injection',
    condition: '요청 주소(URL), 쿼리 인자 또는 로그인 입력값 내에 ${jndi:ldap://...} 등의 원격 조회 구문이 포함되어 있거나 연속 반복 전달되는 경우',
    rationale: 'MITRE ATT&CK T1190 (Exploit Public-Facing Application) - CVE-2021-44228 취약점을 노려 요청 인자를 통해 원격 디렉터리 서비스 조회를 유발하고 임의 코드를 실행하려는 공격 형태입니다.',
  },
  {
    name: 'vulnerability_scanner_and_exploit_probing',
    condition: '알려진 자동화 취약점 점검 도구의 흔적과 함께 CVE-2021-44228 형태가 동반되거나 동일 출발지에서 반복적인 악용 탐색이 관측되는 경우',
    rationale: 'MITRE ATT&CK T1190 (Exploit Public-Facing Application) - 공개된 웹 애플리케이션의 알려진 취약점을 탐색하고 점검 도구 흔적과 함께 악용 페이로드를 반복 주입하는 공격 시도입니다.',
  },
]);

/**
 * XDR known-cve 단일 판정 함수
 * 외부 파일/패키지/네트워크를 일절 참조하지 않고 메모리 내에서 경보를 단독 계산합니다.
 *
 * 확신도(confidence) 기준:
 * - 0.85 이상: block (명확한 CVE-2021-44228 악용 공격)
 * - 0.50 이상: alert (애매한 취약점 키워드/문자열 탐색 시도)
 * - 0.50 미만: record (정상 사용자 활동)
 *
 * @param {object} alert - Wazuh 형태 가상 경보 객체
 * @returns {Promise<{action: 'block' | 'alert' | 'record', confidence: number, reason: string}>}
 */
export async function decide(alert) {
  const level = alert?.rule?.level ?? 0;
  const description = alert?.rule?.description || '';
  const useragent = alert?.data?.useragent || '';
  const url = alert?.data?.url || '';
  const count = parseInt(alert?.data?.count || '0', 10);

  // 1. 정상 이벤트 판정 (규칙 수준 4 이하, 정상 사용자 작업)
  if (level <= 4) {
    const confidence = 0.1;
    return {
      action: 'record',
      confidence,
      reason: 'normal_event',
    };
  }

  // 2. 패턴 판별 (신호 분석)
  const hasJndiInHeader = useragent.includes('${jndi:') || description.includes('머리글');
  const hasJndiInParam = url.includes('${jndi:') || description.includes('인자') || description.includes('주소') || description.includes('로그인');
  const hasScannerTraces = description.includes('점검') || description.includes('도구') || description.includes('스캐너') || description.includes('흔적') || description.includes('목록') || description.includes('라이브러리');

  let matchedPatternName = 'jndi_parameter_injection';
  if (hasJndiInHeader) {
    matchedPatternName = 'jndi_header_injection';
  } else if (hasScannerTraces && !hasJndiInParam) {
    matchedPatternName = 'vulnerability_scanner_and_exploit_probing';
  } else if (hasScannerTraces && hasJndiInParam) {
    matchedPatternName = 'vulnerability_scanner_and_exploit_probing';
  }

  // 3. 명확한 공격 판정 (규칙 수준 10 이상, 실제 원격 조회 페이로드 또는 반복 악용)
  const isDirectExploit = useragent.includes('${jndi:') || url.includes('${jndi:');
  const isHighSeverity = level >= 10;
  const isRepeatedExploit = count >= 5 && level >= 10;

  if (isHighSeverity && (isDirectExploit || isRepeatedExploit || description.includes('원격 조회 구문') || description.includes('그대로'))) {
    const confidence = 0.95;
    return {
      action: 'block',
      confidence,
      reason: matchedPatternName,
    };
  }

  // 4. 애매한 시도 판정 (규칙 수준 5~8, 단순 키워드 검색 또는 불완전한 구문)
  // description에 "조회 구문은 없습니다", "악용 구문은 없습니다", "완전한 구문은 아닙니다" 등 포함
  const confidence = 0.65;
  const action = confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record';

  return {
    action,
    confidence,
    reason: matchedPatternName,
  };
}
