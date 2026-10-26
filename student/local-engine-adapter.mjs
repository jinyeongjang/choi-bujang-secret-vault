// 학생 로컬 검증 어댑터 (2단계: 업무 앱 목록 및 실시간 접근 판정 연동)
// [예시값]: 사내 로컬 환경 검증용 사용자 계정, 등록 보안 단말, 활성 세션 스코프 및 업무 앱 정보

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
  }
};
