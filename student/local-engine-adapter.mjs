// 학생 로컬 검증 어댑터 (1단계: 로그인 정보·기기·세션 식별 연동)
// [예시값]: 사내 로컬 환경 검증용 사용자 계정, 등록 보안 단말, 활성 세션 스코프

const identity = Object.freeze({
  user: Object.freeze({ id: 'shieldus-admin', label: '쉴더스진 보안담당자' }),
  device: Object.freeze({ id: 'shieldus-pc-01', label: '사내 업무용 보안 PC', status: 'compliant' }),
  session: Object.freeze({ id: 'sess-active-2026', status: 'active' })
});

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
};
