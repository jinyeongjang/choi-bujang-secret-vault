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

        if (Array.isArray(ev.supportedActions) && ev.supportedActions.length > 0) {
          const pActionHeader = document.createElement('p');
          pActionHeader.textContent = '조치 제안:';
          box.append(pActionHeader);
          for (const act of ev.supportedActions) {
            const actBtn = document.createElement('button');
            actBtn.type = 'button';
            actBtn.disabled = true;
            actBtn.textContent = `${act} 미지원`;
            box.append(actBtn);
          }
          const pActionNotice = document.createElement('p');
          pActionNotice.textContent = '안내: 조치 실행 연결은 준비 중입니다(아직 지원하지 않는 조치입니다).';
          box.append(pActionNotice);
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
    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
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

      const retryNotice = (err) => {
        const isTimeout = ['REQUEST_TIMEOUT', 'TIMEOUT', 'ENGINE_TIMEOUT'].includes(err?.code);
        const timeoutText = isTimeout ? ' (요청 시간 초과)' : '';
        return `다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.${timeoutText}`;
      };

      // 1. 기기 상태 (devices)
      const devSection = document.createElement('section');
      const devTitle = document.createElement('h4');
      devTitle.textContent = '기기 상태';
      devSection.append(devTitle);

      const deviceStatusLabels = {
        compliant: '보안 기준 충족(compliant)',
        noncompliant: '보안 기준 미충족(noncompliant)',
        unknown: '확인 불가(unknown)',
      };

      if (devices?.status === 'loading') {
        addLine('기기 목록을 불러오는 중…', devSection);
      } else if (devices?.status === 'error') {
        const msg = devices.error?.message || '서버에 연결하지 못했습니다.';
        addLine(`기기 목록을 불러오지 못했습니다: ${msg}`, devSection);
        addLine(retryNotice(devices.error), devSection);
      } else if (devices?.status === 'ok') {
        if (!Array.isArray(devices.data) || devices.data.length === 0) {
          addLine('등록된 기기가 없습니다.', devSection);
        } else {
          const ul = document.createElement('ul');
          for (const dev of devices.data) {
            const li = document.createElement('li');
            const st = deviceStatusLabels[dev.status] || `${dev.status || '확인 불가'}(${dev.status || 'unknown'})`;
            li.textContent = `기기: ${dev.label || dev.id} · ${st}`;
            ul.append(li);
          }
          devSection.append(ul);
        }
      } else {
        addLine('기기 상태 확인 전입니다.', devSection);
      }
      root.append(devSection);

      // 2. 세션 상태 (sessions)
      const sessSection = document.createElement('section');
      const sessTitle = document.createElement('h4');
      sessTitle.textContent = '세션 상태';
      sessSection.append(sessTitle);
      addLine('안내: 세션은 지금 연결 하나만 옵니다(지난 세션 목록이 아닙니다).', sessSection);

      const sessionStatusLabels = {
        active: '활성(active)',
        expired: '만료(expired)',
        revoked: '철회됨(revoked)',
        unknown: '확인 불가(unknown)',
      };

      if (sessions?.status === 'loading') {
        addLine('세션 정보를 불러오는 중…', sessSection);
      } else if (sessions?.status === 'error') {
        const msg = sessions.error?.message || '서버에 연결하지 못했습니다.';
        addLine(`세션 정보를 불러오지 못했습니다: ${msg}`, sessSection);
        addLine(retryNotice(sessions.error), sessSection);
      } else if (sessions?.status === 'ok') {
        if (!Array.isArray(sessions.data) || sessions.data.length === 0) {
          addLine('현재 연결 없음(세션이 없습니다).', sessSection);
        } else {
          const ul = document.createElement('ul');
          for (const sess of sessions.data) {
            const li = document.createElement('li');
            const st = sessionStatusLabels[sess.status] || `${sess.status || '확인 불가'}(${sess.status || 'unknown'})`;
            li.textContent = `세션: ${sess.id} · ${st}`;
            ul.append(li);
          }
          sessSection.append(ul);
        }
      } else {
        addLine('세션 상태 확인 전입니다.', sessSection);
      }
      root.append(sessSection);

      // 3. 주의 알림 (notifications)
      const notiSection = document.createElement('section');
      const notiTitle = document.createElement('h4');
      notiTitle.textContent = '주의 알림';
      notiSection.append(notiTitle);

      if (!Array.isArray(notifications) || notifications.length === 0) {
        addLine('주의할 알림이 없습니다.', notiSection);
      } else {
        const ul = document.createElement('ul');
        for (const noti of notifications) {
          const li = document.createElement('li');
          li.textContent = `[${noti.resource || '알 수 없음'}] ${noti.code || '알림'}: ${noti.message || ''}`;
          ul.append(li);
        }
        notiSection.append(ul);
      }
      root.append(notiSection);

      // 4. 진단 및 도움정보 (diagnostics)
      const diagSection = document.createElement('section');
      const diagTitle = document.createElement('h4');
      diagTitle.textContent = '진단 및 도움정보';
      diagSection.append(diagTitle);

      if (diagnostics?.status === 'loading') {
        addLine('도움정보를 불러오는 중…', diagSection);
      } else if (diagnostics?.status === 'error') {
        const msg = diagnostics.error?.message || '진단 정보를 불러오지 못했습니다.';
        addLine(`도움정보를 불러오지 못했습니다: ${msg}`, diagSection);
        addLine(retryNotice(diagnostics.error), diagSection);
      } else if (diagnostics?.status === 'ok' && diagnostics?.data) {
        const d = diagnostics.data;
        const dl = document.createElement('dl');
        const addDl = (term, desc) => {
          const dt = document.createElement('dt');
          dt.textContent = term;
          const dd = document.createElement('dd');
          dd.textContent = String(desc ?? '확인 불가');
          dl.append(dt, dd);
        };
        addDl('요청 ID', d.requestId);
        addDl('컴포넌트', d.component);
        addDl('버전', d.version);
        addDl('확인 시각', d.checkedAt);
        addDl('엔진 모드', d.engine?.mode);
        addDl('엔진 코드', d.engine?.code);
        diagSection.append(dl);

        const safeData = {
          requestId: d.requestId,
          component: d.component,
          version: d.version,
          checkedAt: d.checkedAt,
          engine: {
            mode: d.engine?.mode,
            code: d.engine?.code,
          },
        };

        const copyNotice = document.createElement('p');
        copyNotice.textContent = '이 정보는 도움 요청에 쓰도록 복사하는 것입니다.';
        diagSection.append(copyNotice);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = '도움정보 복사';
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(safeData, null, 2));
            copyNotice.textContent = '도움정보를 클립보드에 복사했습니다. 이 정보는 도움 요청에 사용됩니다.';
          } catch {
            copyNotice.textContent = '복사에 실패했습니다. 브라우저 클립보드 권한을 확인하세요.';
          }
        });
        diagSection.append(copyBtn);
      } else {
        addLine('도움정보 점검 전입니다. 위쪽 제공 화면의 「도움정보 불러오기」를 누르세요.', diagSection);
      }
      root.append(diagSection);

      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted } = {}) {
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

      if (status === 'idle' || !status) {
        addLine('AI 연결 점검 전입니다.');
        addLine('안내: 다시 점검은 제공 영역의 「AI 연결 점검」 버튼을 직접 누르세요. 자동으로 다시 점검하지 않습니다.');
        return root;
      }

      if (status === 'loading') {
        addLine('AI 연결 점검 중…');
        return root;
      }

      if (status === 'error') {
        const code = error?.code || 'ERROR';
        const message = error?.message || 'AI 연결 점검 중 오류가 발생했습니다.';
        addLine(`AI 연결 점검 실패: [${code}] ${message}`);

        let guidance = '연결 상태를 확인한 뒤 직접 다시 점검하세요.';
        if (['ON_AI_PROVISIONING_PENDING', 'ON_AI_AUTHORIZATION_CHANGED'].includes(code)) {
          guidance = '원인 안내: 권한 준비 중 또는 변경됨. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.';
        } else if (['WB_CLCO_AUTH_REQUIRED', 'WB_CLCO_ACCESS_BLOCKED'].includes(code)) {
          guidance = '원인 안내: 인증 실패 또는 접근 제한. 계정 연결을 다시 확인하거나 담당자에게 확인하세요.';
        } else if (['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED'].includes(code)) {
          guidance = '원인 안내: 반 사용량 또는 이용 한도 초과. 담당자에게 확인하세요.';
        } else if (code === 'WB_CLCO_SESSION_CLOSED') {
          guidance = '원인 안내: 이용 시간 아님. 현재 AI 이용 시간을 확인하세요.';
        } else if (['WB_CLCO_RATE_LIMITED', 'WB_CLCO_TIMEOUT', 'WB_CLCO_NETWORK_ERROR', 'WB_CLCO_SERVER_UNAVAILABLE', 'REQUEST_TIMEOUT'].includes(code)) {
          guidance = '원인 안내: 요청 제한, 시간 초과 또는 네트워크 오류. 잠시 뒤 직접 다시 점검하세요.';
        } else if (['WB_CLCO_CANCELLED', 'REQUEST_CANCELLED'].includes(code)) {
          guidance = '원인 안내: 요청이 취소되었습니다. 이전 결과는 현재 결과가 아닙니다.';
        } else if (['ON_AI_MODEL_LIST_EMPTY', 'MODEL_NOT_CONFIGURED'].includes(code)) {
          guidance = '원인 안내: 쓸 수 있는 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.';
        }
        addLine(guidance);
        addLine('안내: 자동으로 다시 점검하지 않습니다. 다시 점검은 사용자가 버튼을 직접 누르세요.');
        return root;
      }

      if (status === 'ok') {
        const aud = data?.audienceAuthorization;
        const audText = aud === 'verified'
          ? '앱 권한 확인 후 점검(verified)'
          : aud === 'test'
            ? '시험 연결 점검(test)'
            : `점검 완료(${aud || 'unknown'})`;
        addLine(`연결 점검 결과: ${audText}`);
        addLine(`사용 가능한 모델 수: ${data?.modelCount ?? 0}개`);
        if (checkedAt || data?.checkedAt) {
          addLine(`점검 시각: ${checkedAt || data?.checkedAt}`);
        }
        addLine('중요 안내: 사건 설명은 아직 실행하지 않았습니다. 모델 목록 응답은 연결 점검 결과일 뿐이며, 사건 설명은 보안 기록에서 따로 요청하고 확인합니다.');
        return root;
      }

      addLine('확인 불가: AI 연결 점검 상태를 확인할 수 없습니다.');
      return root;
    },
    renderExplanation({ event, explanation, checkedAt } = {}) {
      const root = document.createElement('div');
      const addLine = (text, parent = root) => {
        const line = document.createElement('p');
        line.textContent = text;
        parent.append(line);
        return line;
      };

      // 1) 오류 상태는 event가 null이어도 먼저 표시 (실패 시 data-student-explanation-event 속성 미부여)
      if (explanation?.status === 'error') {
        const code = explanation.error?.code || 'ERROR';
        const message = explanation.error?.message || '사건 설명 생성 중 오류가 발생했습니다.';
        addLine(`AI 설명 실패: [${code}] ${message}`);
        addLine('안내: AI 설명에 실패했으나 보안 기록은 그대로 유지됩니다(과제 실패가 아닙니다).');
        if (code === 'ACTION_ALREADY_EXECUTED' || explanation.data?.executed === true) {
          addLine('안내: AI가 이미 실행했다고 답한 설명은 쓸 수 없습니다.');
        }
        return root;
      }

      // 2) 오류 없이 event가 null인 경우 기록 선택 안내
      if (!event) {
        addLine('보안 기록에서 기록을 먼저 고르세요.');
        return root;
      }

      if (!explanation || explanation.status === 'idle') {
        addLine('선택한 사건의 AI 설명을 확인하세요.');
        return root;
      }

      if (explanation.status === 'loading') {
        addLine('AI 설명을 요청하는 중…');
        return root;
      }

      if (explanation.status === 'ok') {
        const data = explanation.data;
        if (!data) {
          addLine('설명 데이터가 없습니다.');
          return root;
        }

        if (data.executed === true) {
          addLine('AI 설명 실패: [INVALID_EXECUTION_STATE] AI가 이미 실행했다고 답한 설명은 쓸 수 없습니다.');
          addLine('안내: 보안 기록은 그대로 유지됩니다.');
          return root;
        }

        const evidenceList = Array.isArray(event.evidence) ? event.evidence : [];
        const evidenceMap = new Map(evidenceList.map(e => [e.id, e.text]));
        const citedEvidenceIds = Array.isArray(data.evidenceIds) ? data.evidenceIds : [];

        // 근거 ID가 event.evidence에 모두 존재하는지 대조
        const hasMissingEvidence = citedEvidenceIds.some(id => !evidenceMap.has(id));
        if (hasMissingEvidence) {
          addLine('AI 설명 실패: [INSUFFICIENT_EVIDENCE] 근거가 맞지 않아 이 설명을 쓸 수 없습니다(근거 불일치).');
          addLine('안내: 없는 근거 ID를 임의로 맞추지 않으며, 보안 기록은 그대로 유지됩니다.');
          return root;
        }

        // 성공한 경우에만 바깥 요소에 data-student-explanation-event 속성 부여
        root.dataset.studentExplanationEvent = event.id;

        // 1) 사건 ID, AI 설명 제목(참고용), summary
        addLine(`사건 ID: ${event.id}`);
        const titleLine = document.createElement('h4');
        titleLine.textContent = 'AI 설명(참고용)';
        root.append(titleLine);
        addLine(`요약: ${data.summary || '요약 없음'}`);

        // 2) 인용한 근거 ID와 근거 글 ("근거 ID — 근거 글")
        const evTitle = document.createElement('h5');
        evTitle.textContent = '인용한 근거:';
        root.append(evTitle);
        if (citedEvidenceIds.length === 0) {
          addLine('인용한 근거가 없습니다.');
        } else {
          const ul = document.createElement('ul');
          for (const evId of citedEvidenceIds) {
            const li = document.createElement('li');
            li.textContent = `${evId} — ${evidenceMap.get(evId) || '근거 글 없음'}`;
            ul.append(li);
          }
          root.append(ul);
        }

        // 3) event.rules 마다 "규칙 ID — 규칙 글"
        const ruleTitle = document.createElement('h5');
        ruleTitle.textContent = '적용 규칙:';
        root.append(ruleTitle);
        const rulesList = Array.isArray(event.rules) ? event.rules : [];
        if (rulesList.length === 0) {
          addLine('적용 규칙이 없습니다.');
        } else {
          const ul = document.createElement('ul');
          for (const rule of rulesList) {
            const li = document.createElement('li');
            li.textContent = `${rule.id} — ${rule.text}`;
            ul.append(li);
          }
          root.append(ul);
        }

        // 4) event.state에서 unknown인 항목을 접속·세션·기기별로 나열
        const stateTitle = document.createElement('h5');
        stateTitle.textContent = '확인 불가 상태 목록:';
        root.append(stateTitle);
        const st = event.state || {};
        const unknowns = [];
        if (st.access === 'unknown') unknowns.push('접속: 확인 불가(unknown)');
        if (st.session === 'unknown') unknowns.push('세션: 확인 불가(unknown)');
        if (st.device === 'unknown') unknowns.push('기기: 확인 불가(unknown)');

        if (unknowns.length === 0) {
          addLine('확인 불가 상태: 없음');
        } else {
          const ul = document.createElement('ul');
          for (const item of unknowns) {
            const li = document.createElement('li');
            li.textContent = item;
            ul.append(li);
          }
          root.append(ul);
          addLine('주의: 확인할 수 없는 상태를 정상 또는 안전으로 간주하지 마세요.');
        }

        // 5) 제안(proposals) 처리
        const propTitle = document.createElement('h5');
        propTitle.textContent = '조치 제안:';
        root.append(propTitle);
        const proposals = Array.isArray(data.proposals) ? data.proposals : [];
        if (proposals.length === 0) {
          if (!Array.isArray(event.supportedActions) || event.supportedActions.length === 0) {
            addLine('연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).');
          } else {
            addLine('AI가 제안한 조치가 없습니다.');
          }
        } else {
          const ul = document.createElement('ul');
          for (const prop of proposals) {
            const li = document.createElement('li');
            li.textContent = `조치: ${prop.action} · 이유: ${prop.reason}`;
            ul.append(li);
          }
          root.append(ul);
          addLine('주의: 사람 확인이 필요하며 실행되지 않았습니다(제안은 자동으로 실행되지 않습니다).');
        }

        if (checkedAt) {
          addLine(`확인 시각: ${checkedAt}`);
        }
        return root;
      }

      addLine('확인 불가: 사건 설명 상태를 확인할 수 없습니다. 기록은 그대로 유지됩니다.');
      return root;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
