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
    renderDecision({ status, mode, data, error, appId } = {}) {
      const root = document.createElement('div');
      const addLine = (text) => {
        const line = document.createElement('p');
        line.textContent = text;
        root.append(line);
      };

      const modeLabels = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      if (mode && Object.hasOwn(modeLabels, mode)) {
        addLine(`연결 상태: ${modeLabels[mode]}`);
      }

      if (status === 'idle' || !status) {
        addLine('앱을 골라 접속을 요청하세요.');
        return root;
      }

      if (status === 'loading') {
        const targetText = appId ? ` (${appId})` : '';
        addLine(`판정 확인 중…${targetText}`);
        return root;
      }

      if (status === 'error') {
        const message = typeof error?.message === 'string' && error.message.trim()
          ? error.message
          : '요청 중 오류가 발생했습니다.';
        addLine(`요청 실패: ${message}`);
        addLine('안내: 요청 실패는 접근 거부(차단) 판정이 아닙니다. 접근이 허용되지 않았습니다.');
        return root;
      }

      if (status === 'ok') {
        const targetAppId = data?.appId || appId || '알 수 없음';
        const rawDecision = data?.decision;
        const decisionMap = {
          allow: '허용(allow)',
          deny: '거부(deny)',
          challenge: '추가 확인 필요(challenge)',
          unknown: '확인 불가(unknown)',
        };
        const isStandard = typeof rawDecision === 'string' && Object.hasOwn(decisionMap, rawDecision);
        const label = isStandard ? decisionMap[rawDecision] : '확인 불가(unknown)';

        addLine(`대상 앱: ${targetAppId}`);
        addLine(`판정 결과: ${label}`);

        if (rawDecision === 'allow') {
          addLine(`판정 사유: ${data?.reason || '사유 정보 없음'}`);
        } else if (rawDecision === 'deny') {
          addLine('안내: 접근이 허용되지 않았습니다(접근 거부).');
          addLine(`판정 사유: ${data?.reason || '사유 정보 없음'}`);
        } else if (rawDecision === 'challenge') {
          addLine('안내: 추가 확인이 필요합니다. 앱이 확인 절차를 대신하지 않습니다. 접근이 바로 허용되지 않았습니다.');
          addLine(`판정 사유: ${data?.reason || '사유 정보 없음'}`);
        } else {
          addLine('안내: 판정 결과를 확인할 수 없습니다. 정상 또는 접근 허용으로 간주하지 마세요.');
          if (data?.reason) addLine(`판정 사유: ${data.reason}`);
        }

        if (data?.checkedAt) {
          addLine(`판정 시각: ${data.checkedAt}`);
        }
        return root;
      }

      addLine('확인 불가: 판정 상태를 확인할 수 없습니다. 접근이 허용되지 않았습니다.');
      return root;
    },
    renderEvents({ status, mode, data, error } = {}) {
      const root = document.createElement('div');
      const addLine = (text, parent = root) => {
        const line = document.createElement('p');
        line.textContent = text;
        parent.append(line);
        return line;
      };

      const modeLabels = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      if (mode && Object.hasOwn(modeLabels, mode)) {
        addLine(`연결 상태: ${modeLabels[mode]}`);
      }

      if (status === 'loading') {
        addLine('기록을 불러오는 중…');
        return root;
      }

      if (status === 'error') {
        const message = typeof error?.message === 'string' && error.message.trim()
          ? error.message
          : '서버에 연결하지 못했습니다.';
        addLine(`기록을 불러오지 못했습니다: ${message}`);
        return root;
      }

      if (status !== 'ok') {
        addLine('확인 불가: 보안 기록 상태를 확인할 수 없습니다.');
        return root;
      }

      if (!Array.isArray(data) || data.length === 0) {
        addLine('표시할 기록이 없습니다.');
        return root;
      }

      // 1) data 복사 및 at 기준 최신순 정렬
      const events = [...data].sort((a, b) => {
        const timeA = a?.at ? Date.parse(a.at) : 0;
        const timeB = b?.at ? Date.parse(b.at) : 0;
        return timeB - timeA;
      });

      const kindLabels = {
        access: '접속(access)',
        xdr: 'XDR 경보(xdr)',
      };
      const accessLabels = {
        allowed: '허용됨(allowed)',
        denied: '거부됨(denied)',
        unknown: '확인 불가(unknown)',
      };
      const sessionLabels = {
        active: '활성(active)',
        expired: '만료(expired)',
        revoked: '철회됨(revoked)',
        unknown: '확인 불가(unknown)',
      };
      const deviceLabels = {
        compliant: '보안 기준 충족(compliant)',
        noncompliant: '보안 기준 미충족(noncompliant)',
        unknown: '확인 불가(unknown)',
      };

      const toLabel = (map, val) => map[val] || (val ? `${val}` : '확인 불가(unknown)');

      // 필터 상태
      let currentFilterKind = 'all';
      let currentFilterApp = 'all';
      let currentFilterAccess = 'all';
      let selectedEventId = null;

      // 2) 필터 컨테이너
      const filterContainer = document.createElement('div');
      filterContainer.className = 'student-event-filters';

      const kinds = ['all', ...new Set(events.map(e => e.kind).filter(Boolean))];
      const apps = ['all', ...new Set(events.map(e => e.appId || 'none'))];
      const accesses = ['all', ...new Set(events.map(e => e.state?.access).filter(Boolean))];

      const createSelect = (labelText, optionsList, onChange) => {
        const wrap = document.createElement('label');
        wrap.textContent = `${labelText}: `;
        wrap.setAttribute('aria-label', labelText);
        const sel = document.createElement('select');
        sel.setAttribute('aria-label', labelText);
        for (const optVal of optionsList) {
          const opt = document.createElement('option');
          opt.value = optVal;
          if (optVal === 'all') {
            opt.textContent = '전체(all)';
          } else if (labelText === '기록 종류') {
            opt.textContent = kindLabels[optVal] || optVal;
          } else if (labelText === '접속 상태') {
            opt.textContent = accessLabels[optVal] || optVal;
          } else if (optVal === 'none') {
            opt.textContent = '앱 없음(none)';
          } else {
            opt.textContent = optVal;
          }
          sel.append(opt);
        }
        sel.addEventListener('change', () => {
          onChange(sel.value);
          renderListAndDetail();
        });
        wrap.append(sel);
        return wrap;
      };

      filterContainer.append(
        createSelect('기록 종류', kinds, v => { currentFilterKind = v; }),
        createSelect('업무 앱', apps, v => { currentFilterApp = v; }),
        createSelect('접속 상태', accesses, v => { currentFilterAccess = v; })
      );
      root.append(filterContainer);

      const listContainer = document.createElement('div');
      const detailContainer = document.createElement('div');
      root.append(listContainer, detailContainer);

      const renderDetail = (ev) => {
        detailContainer.replaceChildren();
        const box = document.createElement('div');
        box.dataset.studentEventDetail = ev.id;

        const heading = document.createElement('h4');
        heading.textContent = `기록 상세: ${ev.id}`;
        box.append(heading);

        const pApp = document.createElement('p');
        pApp.textContent = `업무 앱: ${ev.appId ? ev.appId : '앱 확인 불가(appId 없음)'}`;
        box.append(pApp);

        const pState = document.createElement('p');
        const accLabel = toLabel(accessLabels, ev.state?.access);
        const sessLabel = toLabel(sessionLabels, ev.state?.session);
        const devLabel = toLabel(deviceLabels, ev.state?.device);
        pState.textContent = `상태: 접속 ${accLabel} · 세션 ${sessLabel} · 기기 ${devLabel}`;
        box.append(pState);

        const pEvHeader = document.createElement('p');
        pEvHeader.textContent = '근거 목록:';
        box.append(pEvHeader);
        if (Array.isArray(ev.evidence) && ev.evidence.length > 0) {
          const evUl = document.createElement('ul');
          for (const item of ev.evidence) {
            const evLi = document.createElement('li');
            evLi.textContent = `[${item.id}] ${item.text}`;
            evUl.append(evLi);
          }
          box.append(evUl);
        } else {
          const noEv = document.createElement('p');
          noEv.textContent = '근거 정보가 없습니다.';
          box.append(noEv);
        }

        const pRuleHeader = document.createElement('p');
        pRuleHeader.textContent = '적용 규칙:';
        box.append(pRuleHeader);
        if (Array.isArray(ev.rules) && ev.rules.length > 0) {
          const ruleUl = document.createElement('ul');
          for (const item of ev.rules) {
            const ruleLi = document.createElement('li');
            ruleLi.textContent = `[${item.id}] ${item.text}`;
            ruleUl.append(ruleLi);
          }
          box.append(ruleUl);
        } else {
          const noRules = document.createElement('p');
          noRules.textContent = '적용 규칙 정보가 없습니다.';
          box.append(noRules);
        }

        detailContainer.append(box);
      };

      const renderListAndDetail = () => {
        listContainer.replaceChildren();
        detailContainer.replaceChildren();

        const filtered = events.filter(e => {
          if (currentFilterKind !== 'all' && e.kind !== currentFilterKind) return false;
          const appVal = e.appId || 'none';
          if (currentFilterApp !== 'all' && appVal !== currentFilterApp) return false;
          if (currentFilterAccess !== 'all' && e.state?.access !== currentFilterAccess) return false;
          return true;
        });

        if (filtered.length === 0) {
          const empty = document.createElement('p');
          empty.textContent = '조건에 일치하는 기록이 없습니다.';
          listContainer.append(empty);
          return;
        }

        const ul = document.createElement('ul');
        for (const ev of filtered) {
          const li = document.createElement('li');
          li.dataset.studentEventId = ev.id;

          const pInfo = document.createElement('p');
          const timeText = ev.at || '시각 확인 불가';
          const kindText = kindLabels[ev.kind] || ev.kind || '종류 확인 불가';
          const appText = ev.appId ? ev.appId : '앱 확인 불가(appId 없음)';
          const summaryText = ev.summary || '요약 없음';

          pInfo.textContent = `[${kindText}] ${timeText} · ID: ${ev.id} · 앱: ${appText} - ${summaryText}`;
          li.append(pInfo);

          const detailBtn = document.createElement('button');
          detailBtn.type = 'button';
          detailBtn.textContent = `${ev.id} 상세`;
          detailBtn.setAttribute('aria-label', `${ev.id} 상세`);
          detailBtn.addEventListener('click', () => {
            selectedEventId = ev.id;
            renderDetail(ev);
          });
          li.append(detailBtn);

          ul.append(li);
        }
        listContainer.append(ul);

        if (selectedEventId) {
          const cur = filtered.find(e => e.id === selectedEventId);
          if (cur) renderDetail(cur);
        }
      };

      renderListAndDetail();
      return root;
    },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
