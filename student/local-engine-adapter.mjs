// 학생 로컬 검증 어댑터 (XDR 확장 탐지 및 대응 체계 강화)
// [예시값]: 사내 로컬 환경 검증용 사용자 계정, 등록 보안 단말, 활성 세션 스코프, 업무 앱 및 XDR 보안 위협 이벤트

const identity = Object.freeze({
  user: Object.freeze({ id: 'shieldus-admin', label: '쉴더스진 보안담당자' }),
  device: Object.freeze({ id: 'shieldus-pc-01', label: '사내 업무용 보안 PC', status: 'compliant' }),
  session: Object.freeze({ id: 'sess-active-2026', status: 'active' })
});

const defaultApps = Object.freeze([
  { id: 'vault-notes', name: '사내 보안 메모 금고' },
  { id: 'code-repo', name: '사내 형상관리 저장소' },
  { id: 'approval-system', name: '전자결재 및 보안 승인 체계' }
]);

const defaultEvents = Object.freeze([
  {
    id: 'evt-sec-01',
    kind: 'access',
    at: '2026-10-27T07:10:00.000Z',
    appId: 'vault-notes',
    summary: '사내 보안 메모 금고 정상 인가 접속 기록',
    evidence: [
      { id: 'ev-01', text: '단말 규격: compliant (사내 등록 보안 에이전트 무결성 확인)' },
      { id: 'ev-02', text: '세션 상태: active (유효 토큰 및 접속자 ID 일치)' }
    ],
    rules: [
      { id: 'rule-01', text: '정상 등록 단말 및 세션 허용 정책 통과 (ZTNA-POL-01)' }
    ],
    state: { access: 'allowed', session: 'active', device: 'compliant' },
    supportedActions: []
  },
  {
    id: 'evt-xdr-02',
    kind: 'xdr',
    at: '2026-10-27T07:35:00.000Z',
    appId: 'approval-system',
    summary: '미등록 외부 IP 대역에서의 관리자 결재 체계 접근 시도 탐지',
    evidence: [
      { id: 'ev-x01', text: '비정상 접근 IP 감지: 198.51.100.45 (미등록 공용 서브넷)' },
      { id: 'ev-x02', text: '인증 단계: 1차 비밀번호 일치 후 2차 MFA 인증 미수행' }
    ],
    rules: [
      { id: 'rule-x01', text: '외부 접속 시 2차 추가 인증 필수 적용 규칙 (SEC-XDR-MFA)' },
      { id: 'rule-x02', text: '사내 전용 결재 시스템 공용망 직접 접근 차단 정책 (ZTNA-NET-09)' }
    ],
    state: { access: 'denied', session: 'active', device: 'compliant' },
    supportedActions: ['revoke-session']
  },
  {
    id: 'evt-xdr-03',
    kind: 'xdr',
    at: '2026-10-27T07:50:00.000Z',
    appId: 'code-repo',
    summary: '단말 보안 기준 미충족(noncompliant) 상태에서의 형상관리 저장소 소스코드 대량 복제 시도',
    evidence: [
      { id: 'ev-x03', text: '엔드포인트 상태: 필수 안티바이러스 실시간 감시 일시 중단 감지' },
      { id: 'ev-x04', text: '이상 행위 패턴: 짧은 시간(30초 내) 대량 git clone 요청 발생' },
      { id: 'ev-x05', text: '네트워크 트래픽: 암호화 터널 우회 시도 포트 감지' }
    ],
    rules: [
      { id: 'rule-x03', text: '엔드포인트 보안 규격 미충족 단말 소스코드 접근 금지 (EDR-DEV-BLOCK)' },
      { id: 'rule-x04', text: '대량 데이터 유출 이상 징후 방지 규칙 (DLP-ANOMALY-04)' }
    ],
    state: { access: 'denied', session: 'active', device: 'noncompliant' },
    supportedActions: ['isolate-device', 'revoke-session']
  }
]);

export default {
  evidenceMode: 'connected',
  projectId: 'shieldus-jin-vault',
  readIdentity: async () => structuredClone(identity),
  readDevices: async (scope) => [
    {
      id: identity.device.id,
      label: identity.device.label,
      status: identity.device.status,
      subjectId: scope?.subjectId ?? identity.user.id,
      projectId: scope?.projectId ?? 'shieldus-jin-vault'
    }
  ],
  readSessions: async (scope) => [
    {
      id: identity.session.id,
      status: identity.session.status,
      subjectId: scope?.subjectId ?? identity.user.id,
      projectId: scope?.projectId ?? 'shieldus-jin-vault'
    }
  ],
  readApps: async (scope) => defaultApps.map(app => ({
    id: app.id,
    name: app.name,
    subjectId: scope?.subjectId ?? identity.user.id,
    projectId: scope?.projectId ?? 'shieldus-jin-vault'
  })),
  decideAccess: async (input, scope) => {
    const appId = input?.appId;
    let decision = 'allow';
    let reason = '정상 등록 보안 단말 및 활성 세션 확인 완료';

    if (appId === 'approval-system') {
      decision = 'challenge';
      reason = '민감 업무 승인을 위해 추가 본인 확인(MFA)이 필요합니다.';
    } else if (!defaultApps.some(a => a.id === appId)) {
      decision = 'deny';
      reason = '미등록 업무 애플리케이션 접근 차단';
    }

    return {
      appId,
      decision,
      reason,
      checkedAt: new Date().toISOString(),
      requestId: input?.requestId,
      subjectId: scope?.subjectId ?? identity.user.id,
      projectId: scope?.projectId ?? 'shieldus-jin-vault'
    };
  },
  readEvents: async (scope) => defaultEvents.map(evt => ({
    ...evt,
    evidence: evt.evidence.map(e => ({ ...e })),
    rules: evt.rules.map(r => ({ ...r })),
    state: { ...evt.state },
    supportedActions: [...evt.supportedActions],
    subjectId: scope?.subjectId ?? identity.user.id,
    projectId: scope?.projectId ?? 'shieldus-jin-vault'
  }))
};
