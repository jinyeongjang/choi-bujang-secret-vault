// 학생 로컬 검증 어댑터 (3단계: 보안 기록 및 XDR 이벤트 타임라인 연동)
// [예시값]: 사내 로컬 환경 검증용 사용자 계정, 등록 보안 단말, 활성 세션 스코프, 업무 앱 및 보안 이벤트

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
    at: '2026-10-26T02:00:00.000Z',
    appId: 'vault-notes',
    summary: '사내 보안 메모 금고 정상 인가 접속 기록',
    evidence: [{ id: 'ev-01', text: '단말 규격: compliant, 세션 상태: active' }],
    rules: [{ id: 'rule-01', text: '정상 등록 단말 및 세션 허용 정책 통과' }],
    state: { access: 'allowed', session: 'active', device: 'compliant' },
    supportedActions: []
  },
  {
    id: 'evt-xdr-02',
    kind: 'xdr',
    at: '2026-10-26T02:10:00.000Z',
    appId: 'approval-system',
    summary: '미등록 위치에서의 결재 체계 접근 시도 탐지 및 챌린지 요구',
    evidence: [{ id: 'ev-02', text: '접근 IP 대역 이상 징후 감지 및 MFA 챌린지 요구' }],
    rules: [{ id: 'rule-02', text: '원격 접속 시 2차 추가 인증 필수 적용 규칙' }],
    state: { access: 'denied', session: 'active', device: 'compliant' },
    supportedActions: []
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
