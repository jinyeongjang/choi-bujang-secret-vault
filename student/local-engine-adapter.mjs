// 학생 로컬 검증 어댑터 (멀티 테넌트 관리, 테넌트 격리 및 시스템 관리 기능 추가)
// [예시값]: 사내 로컬 환경 검증용 테넌트 구성 및 테넌트별 제로트러스트 스코프 데이터

// 테넌트 정의 (사내 조직별 독립 보안 도메인)
const tenants = [
  {
    id: 'tenant-hq-defense',
    name: '본사 보안운영센터(SOC)',
    tier: 'Enterprise',
    status: 'active',
    policyMode: 'strict-ztna',
    user: { id: 'shieldus-admin', label: '쉴더스진 보안담당자' },
    device: { id: 'shieldus-pc-01', label: '사내 업무용 보안 PC', status: 'compliant' },
    session: { id: 'sess-active-2026', status: 'active' },
    projectId: 'shieldus-jin-vault'
  },
  {
    id: 'tenant-rnd-lab',
    name: 'R&D 연구개발연구소',
    tier: 'Enterprise',
    status: 'active',
    policyMode: 'dev-isolated',
    user: { id: 'rnd-lead-01', label: '연구소 책임연구원' },
    device: { id: 'rnd-workstation-09', label: '연구소 고성능 분석 PC', status: 'compliant' },
    session: { id: 'sess-rnd-9901', status: 'active' },
    projectId: 'rnd-crypto-vault'
  },
  {
    id: 'tenant-finance-ops',
    name: '금융·회계 감사팀',
    tier: 'Standard',
    status: 'maintenance',
    policyMode: 'audit-only',
    user: { id: 'finance-auditor-02', label: '선임 회계감사인' },
    device: { id: 'finance-laptop-03', label: '감사 전용 단말', status: 'compliant' },
    session: { id: 'sess-fin-4102', status: 'active' },
    projectId: 'finance-audit-vault'
  }
];

// 현재 활성 테넌트 (기본: 본사 SOC)
let activeTenantId = 'tenant-hq-defense';

function getActiveTenant() {
  return tenants.find(t => t.id === activeTenantId) || tenants[0];
}

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
  get projectId() {
    return getActiveTenant().projectId;
  },

  // 1. 테넌트 관리 및 선택 API
  getTenants: async () => structuredClone(tenants),
  getActiveTenant: async () => structuredClone(getActiveTenant()),
  selectTenant: async (tenantId) => {
    const target = tenants.find(t => t.id === tenantId);
    if (!target) throw new Error(`TENANT_NOT_FOUND: ${tenantId}`);
    activeTenantId = target.id;
    return structuredClone(target);
  },

  // 2. 시스템 전역 관리 및 진단 지표
  getSystemStatus: async () => ({
    service: 'Alekov ZTNA & XDR Multi-Tenant Controller',
    version: '0.2.11',
    uptimeSeconds: Math.floor(process.uptime()),
    activeTenantsCount: tenants.filter(t => t.status === 'active').length,
    totalTenantsCount: tenants.length,
    currentTenant: getActiveTenant().id,
    policyEngine: {
      mode: getActiveTenant().policyMode,
      enforced: true,
      lastRuleSync: new Date().toISOString()
    }
  }),

  // 3. 테넌트 격리된 사용자·기기·세션 식별
  readIdentity: async () => {
    const cur = getActiveTenant();
    return {
      user: structuredClone(cur.user),
      device: structuredClone(cur.device),
      session: structuredClone(cur.session)
    };
  },

  readDevices: async (scope) => {
    const cur = getActiveTenant();
    return [
      {
        id: cur.device.id,
        label: cur.device.label,
        status: cur.device.status,
        subjectId: scope?.subjectId ?? cur.user.id,
        projectId: scope?.projectId ?? cur.projectId
      }
    ];
  },

  readSessions: async (scope) => {
    const cur = getActiveTenant();
    return [
      {
        id: cur.session.id,
        status: cur.session.status,
        subjectId: scope?.subjectId ?? cur.user.id,
        projectId: scope?.projectId ?? cur.projectId
      }
    ];
  },

  readApps: async (scope) => {
    const cur = getActiveTenant();
    return defaultApps.map(app => ({
      id: app.id,
      name: app.name,
      subjectId: scope?.subjectId ?? cur.user.id,
      projectId: scope?.projectId ?? cur.projectId
    }));
  },

  decideAccess: async (input, scope) => {
    const cur = getActiveTenant();
    const appId = input?.appId;
    let decision = 'allow';
    let reason = `[${cur.name}] 정상 등록 보안 단말 및 활성 세션 검증 완료`;

    if (appId === 'approval-system') {
      decision = 'challenge';
      reason = `[${cur.name}] 민감 업무 승인을 위해 추가 본인 확인(MFA)이 필요합니다.`;
    } else if (!defaultApps.some(a => a.id === appId)) {
      decision = 'deny';
      reason = `[${cur.name}] 미등록 업무 애플리케이션 접근 차단`;
    }

    return {
      appId,
      decision,
      reason,
      checkedAt: new Date().toISOString(),
      requestId: input?.requestId,
      subjectId: scope?.subjectId ?? cur.user.id,
      projectId: scope?.projectId ?? cur.projectId
    };
  },

  readEvents: async (scope) => {
    const cur = getActiveTenant();
    return defaultEvents.map(evt => ({
      ...evt,
      summary: `[${cur.name}] ${evt.summary}`,
      evidence: evt.evidence.map(e => ({ ...e })),
      rules: evt.rules.map(r => ({ ...r })),
      state: { ...evt.state },
      supportedActions: [...evt.supportedActions],
      subjectId: scope?.subjectId ?? cur.user.id,
      projectId: scope?.projectId ?? cur.projectId
    }));
  }
};
