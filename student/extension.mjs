// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('div');
      const addLine = (text) => {
        const line = document.createElement('p');
        line.textContent = text;
        root.append(line);
      };

      const resources = [
        ['로그인 정보', me],
        ['기기 정보', devices],
        ['세션 정보', sessions],
      ];
      const modeLabels = {
        connected: '연결됨',
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      const modes = [...new Set(resources
        .map(([, resource]) => resource?.mode)
        .filter((mode) => Object.hasOwn(modeLabels, mode) && mode !== 'connected'))];
      for (const mode of modes) addLine(`연결 상태: ${modeLabels[mode]}`);

      // 각 응답의 상태를 독립 처리한다. error/loading인 자원의 data는 사용하지 않는다.
      const isOk = (name, resource) => {
        if (resource?.status === 'loading') {
          addLine(`${name}: 불러오는 중`);
          return false;
        }
        if (resource?.status === 'error') {
          const message = typeof resource?.error?.message === 'string' && resource.error.message.trim()
            ? resource.error.message
            : '서버에 연결하지 못했습니다.';
          addLine(`연결 실패: ${message} (${name})`);
          return false;
        }
        if (resource?.status !== 'ok') {
          addLine(`확인 불가: ${name} 상태를 확인할 수 없습니다.`);
          return false;
        }
        return true;
      };

      const deviceStatusLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionStatusLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const statusLabel = (labels, status) => {
        const text = labels[status] || '확인 불가';
        return status ? `${text}(${status})` : text;
      };
      const itemName = (item) => {
        if (typeof item?.label === 'string' && item.label.trim()) return item.label;
        if (typeof item?.id === 'string' && item.id.trim()) return item.id;
        return '이름 확인 불가';
      };
      const itemId = (item) => typeof item?.id === 'string' && item.id.trim()
        ? ` (ID: ${item.id})`
        : '';

      if (isOk('로그인 정보', me)) {
        const data = me.data;
        if (!data?.user || !data?.device || !data?.session) {
          addLine('확인 불가: 로그인·기기·세션 정보를 확인할 수 없습니다. (로그인 정보)');
        } else {
          const deviceWarning = data.device.status === 'noncompliant' ? ' [주의: 비정상 상태]' : '';
          const sessionWarning = ['expired', 'revoked'].includes(data.session.status) ? ' [주의: 비정상 상태]' : '';
          addLine(`사용자: ${itemName(data.user)}${itemId(data.user)}`);
          addLine(`현재 기기: ${itemName(data.device)}${itemId(data.device)} · ${statusLabel(deviceStatusLabels, data.device.status)}${deviceWarning}`);
          addLine(`로그인 세션: ${itemName(data.session)}${itemId(data.session)} · ${statusLabel(sessionStatusLabels, data.session.status)}${sessionWarning}`);
        }
      }

      if (isOk('기기 정보', devices)) {
        if (!Array.isArray(devices.data)) {
          addLine('확인 불가: 기기 목록을 확인할 수 없습니다.');
        } else {
          addLine('기기 목록:');
          if (devices.data.length === 0) addLine('표시할 기기가 없습니다.');
          for (const device of devices.data) {
            const warning = device?.status === 'noncompliant' ? ' [주의: 비정상 상태]' : '';
            addLine(`기기: ${itemName(device)}${itemId(device)} · ${statusLabel(deviceStatusLabels, device?.status)}${warning}`);
          }
        }
      }

      if (isOk('세션 정보', sessions)) {
        if (!Array.isArray(sessions.data)) {
          addLine('확인 불가: 세션 목록을 확인할 수 없습니다.');
        } else {
          addLine('세션 목록:');
          if (sessions.data.length === 0) addLine('표시할 세션이 없습니다.');
          for (const session of sessions.data) {
            const warning = ['expired', 'revoked'].includes(session?.status) ? ' [주의: 비정상 상태]' : '';
            addLine(`세션: ${itemName(session)}${itemId(session)} · ${statusLabel(sessionStatusLabels, session?.status)}${warning}`);
          }
        }
      }
      return root;
    },
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
