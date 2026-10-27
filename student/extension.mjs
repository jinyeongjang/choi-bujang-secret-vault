// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView({ onChange } = {}) {
  const view = {
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

      // 5. [핵심 기능 2] 내 PC 리소스 상태 및 건전성 추이 (일반 사용자 권한 실측)
      const pcSection = document.createElement('section');
      pcSection.className = 'student-pc-health-section';
      const pcTitle = document.createElement('h4');
      pcTitle.textContent = '내 PC 리소스 상태 및 건전성 추이';
      pcSection.append(pcTitle);

      const pcDesc = document.createElement('p');
      pcDesc.textContent = '일반 권한으로 실측된 단말 메모리·CPU·디스크 가용량이며, 보안 사건 발생 시점의 리소스 병목 추이를 확인합니다.';
      pcDesc.className = 'muted';
      pcSection.append(pcDesc);

      const pcContainer = document.createElement('div');
      pcContainer.id = 'student-pc-health-content';
      pcContainer.setAttribute('aria-live', 'polite');
      pcSection.append(pcContainer);

      const loadPcHealthBtn = document.createElement('button');
      loadPcHealthBtn.type = 'button';
      loadPcHealthBtn.textContent = '내 PC 리소스 실측 및 추이 다시 조회';
      loadPcHealthBtn.className = 'student-action-btn';
      loadPcHealthBtn.setAttribute('aria-label', '내 PC 리소스 실측 및 건전성 추이 다시 조회');

      const renderHealthData = (health) => {
        pcContainer.textContent = '';
        if (!health || health.ok !== true || !health.data) {
          const p = document.createElement('p');
          p.className = 'state state-error';
          p.textContent = '[확인 불가] 시스템 리소스 측정 실패';
          const reason = document.createElement('p');
          reason.textContent = '- 실패한 항목: 로컬 PC 리소스 통계\n- 이유: 백엔드 API 응답 미수신 또는 형식 불일치\n- 다음에 할 일: 서버 실행 상태(http://127.0.0.1:5189)를 점검하고 「다시 조회」를 누르세요.';
          pcContainer.append(p, reason);
          return;
        }

        const d = health.data;
        const dl = document.createElement('dl');
        const addDlRow = (term, val, isMeasured = true, errorReason = '', nextAction = '') => {
          const dt = document.createElement('dt');
          dt.textContent = term;
          const dd = document.createElement('dd');
          if (!isMeasured || errorReason) {
            dd.textContent = `[확인 불가] (실패한 항목: ${term} / 이유: ${errorReason || '권한 부족 또는 OS 통계 제한'} / 다음에 할 일: ${nextAction || '시스템 설정 확인 후 다시 조회'})`;
            dd.className = 'state state-error';
          } else {
            dd.textContent = `[실측값] ${val}`;
          }
          dl.append(dt, dd);
        };

        // 잰 시각
        addDlRow('측정 시각 (잰 시각)', d.measuredAt ? `${d.measuredAt} (ISO)` : '', Boolean(d.measuredAt));

        // 메모리
        if (d.memory && !d.memory.error) {
          const memStr = `총 ${d.memory.totalMB} MB 중 가용 ${d.memory.freeMB} MB (사용률: ${d.memory.usagePercent} %, 보안Agent 점유: ${d.memory.agentRssMB} MB)`;
          addDlRow('메모리 가용량 및 Agent 점유율', memStr, true);
        } else {
          addDlRow('메모리 가용량 및 Agent 점유율', '', false, d.memory?.error || '메모리 통계 접근 실패', '작업 관리자에서 프로세스 상태를 점검하세요.');
        }

        // CPU
        if (d.cpu && !d.cpu.error) {
          const cpuStr = `${d.cpu.model} (논리 코어: ${d.cpu.coreCount} 개, 시스템 가동: ${d.cpu.uptimeSeconds} 초, Agent 가동: ${d.cpu.agentUptimeSeconds} 초)`;
          addDlRow('CPU 및 가동 시간', cpuStr, true);
        } else {
          addDlRow('CPU 및 가동 시간', '', false, d.cpu?.error || 'CPU 정보 조회 실패', 'Windows 전원 및 코어 상태를 확인하세요.');
        }

        // 디스크
        if (d.disk && !d.disk.error) {
          const diskStr = `설치 디렉터리 가용 ${d.disk.freeGB} GB / 전체 ${d.disk.totalGB} GB (가용률: ${d.disk.freePercent} %)`;
          addDlRow('디스크 남은 공간 (설치 경로)', diskStr, true);
        } else {
          addDlRow('디스크 남은 공간 (설치 경로)', '', false, d.disk?.error || '디스크 파일시스템 통계 미지원', '설치 드라이브의 디스크 권한 및 잔여 용량을 확인하세요.');
        }

        pcContainer.append(dl);

        // 추이 비교 및 설명
        const trendP = document.createElement('p');
        trendP.className = 'muted';
        if (d.memory && !d.memory.error) {
          const memState = d.memory.usagePercent > 85 ? '주의(고부하)' : '안정(정상)';
          trendP.textContent = `[추이 분석 설명] 단말 리소스 건전성: ${memState}. 가용 메모리가 충분하여 보안 사건 및 XDR 경보 수신 처리에 병목이 발생하지 않는 상태입니다.`;
        } else {
          trendP.textContent = '[추이 분석 설명] 리소스 실측 실패로 인해 단말 병목 추이를 분석할 수 없습니다.';
        }
        pcContainer.append(trendP);
      };

      loadPcHealthBtn.addEventListener('click', async () => {
        loadPcHealthBtn.disabled = true;
        loadPcHealthBtn.setAttribute('aria-busy', 'true');
        loadPcHealthBtn.textContent = '⏳ 리소스 측정 중… (잠시만 기다려 주세요)';
        try {
          const res = await fetch('/api/pc-health');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          renderHealthData(json);
        } catch (err) {
          pcContainer.textContent = '';
          const p = document.createElement('p');
          p.className = 'state state-error';
          p.textContent = `[확인 불가] 리소스 조회 실패`;
          const detail = document.createElement('p');
          detail.textContent = `- 실패한 항목: /api/pc-health 통신\n- 이유: ${err.message || '네트워크 연결 불가'}\n- 다음에 할 일: 로컬 서버 구동(node src/server.mjs) 여부를 확인한 뒤 「다시 조회」를 누르세요.`;
          pcContainer.append(p, detail);
        } finally {
          loadPcHealthBtn.disabled = false;
          loadPcHealthBtn.removeAttribute('aria-busy');
          loadPcHealthBtn.textContent = '내 PC 리소스 실측 및 추이 다시 조회';
        }
      });

      pcSection.append(loadPcHealthBtn);
      root.append(pcSection);

      // 6. [핵심 기능 3] 네트워크 구성 및 방화벽·OS 이벤트 진단 (읽기 전용, SDP 분리)
      const secSection = document.createElement('section');
      secSection.className = 'student-network-security-section';
      const secTitle = document.createElement('h4');
      secTitle.textContent = '네트워크 구성 및 OS 보안 진단 (읽기 전용)';
      secSection.append(secTitle);

      const secNotice = document.createElement('p');
      secNotice.textContent = '안내: 본 건수는 단말 로컬의 일반 운영체제 시스템 이벤트 통계이며, 침해 사고나 외부 공격 탐지 결과가 아닙니다. 방화벽과 보안 설정은 조회만 수행하며 절대 변경하지 않습니다.';
      secNotice.className = 'muted';
      secSection.append(secNotice);

      const secContainer = document.createElement('div');
      secContainer.id = 'student-network-security-content';
      secContainer.setAttribute('aria-live', 'polite');
      secSection.append(secContainer);

      const loadSecBtn = document.createElement('button');
      loadSecBtn.type = 'button';
      loadSecBtn.textContent = '네트워크 구성 및 방화벽·이벤트 실측 다시 조회';
      loadSecBtn.className = 'student-action-btn';
      loadSecBtn.setAttribute('aria-label', '네트워크 구성 및 방화벽, Windows 이벤트 실측 다시 조회');

      const renderSecData = (sec) => {
        secContainer.textContent = '';
        if (!sec || sec.ok !== true || !sec.data) {
          const p = document.createElement('p');
          p.className = 'state state-error';
          p.textContent = '[확인 불가] 네트워크 및 보안 진단 실패';
          const reason = document.createElement('p');
          reason.textContent = '- 실패한 항목: 보안 진단 API 응답\n- 이유: 백엔드 서비스 응답 누락\n- 다음에 할 일: 네트워크 상태를 점검하고 「다시 조회」를 누르세요.';
          secContainer.append(p, reason);
          return;
        }

        const d = sec.data;
        const dl = document.createElement('dl');
        const addDlRow = (term, val, isSuccess = true, errorReason = '', nextAction = '') => {
          const dt = document.createElement('dt');
          dt.textContent = term;
          const dd = document.createElement('dd');
          if (!isSuccess || errorReason) {
            dd.textContent = `[확인 불가] (실패한 항목: ${term} / 이유: ${errorReason || '권한 부족 또는 시스템 제한'} / 다음에 할 일: ${nextAction || '운영체제 서비스 상태 확인'})`;
            dd.className = 'state state-error';
          } else {
            dd.textContent = `[실측값] ${val}`;
          }
          dl.append(dt, dd);
        };

        // SDP 연결 상태 명시적 분리
        const sdpDt = document.createElement('dt');
        sdpDt.textContent = 'SDP 서버 연동 상태';
        const sdpDd = document.createElement('dd');
        sdpDd.textContent = '[SDP 미연결 (disconnected)] 로컬 PC 조회가 성공하였으나 상위 SDP 서버와는 연동되지 않은 상태입니다.';
        sdpDd.className = 'tag tag-disconnected';
        dl.append(sdpDt, sdpDd);

        // 잰 시각
        addDlRow('측정 시각 (잰 시각)', d.measuredAt ? `${d.measuredAt} (ISO)` : '', Boolean(d.measuredAt));

        // 네트워크 인터페이스
        if (Array.isArray(d.interfaces) && d.interfaces.length > 0) {
          const ifaceDetails = d.interfaces.map(i => {
            const addrs = (i.addresses || []).map(a => `${a.family}: ${a.address}`).join(' / ');
            return `${i.name} [${addrs}]`;
          }).join(', ');
          addDlRow('활성 네트워크 인터페이스', ifaceDetails, true);
        } else {
          addDlRow('활성 네트워크 인터페이스', '', false, '활성 네트워크 인터페이스를 읽지 못함', '네트워크 어댑터 드라이버 상태를 확인하세요.');
        }

        // 방화벽 프로필 상태 (읽기 전용)
        if (d.firewall && !d.firewall.error && d.firewall.profiles) {
          const p = d.firewall.profiles;
          const fwStr = `도메인: ${p.domain || '확인 불가'}, 개인: ${p.private || '확인 불가'}, 공용: ${p.public || '확인 불가'} (상태: 읽기 전용 조회 성공)`;
          addDlRow('Windows 방화벽 프로필 설정', fwStr, true);
        } else {
          addDlRow('Windows 방화벽 프로필 설정', '', false, d.firewall?.error || '방화벽 설정 조회 실패', 'Windows Defender 방화벽 서비스 가동 상태를 확인하세요.');
        }

        // 최근 Windows 이벤트 로그 건수
        if (d.winEvents && !d.winEvents.error) {
          const appC = d.winEvents.application?.warningsAndErrors ?? 0;
          const sysC = d.winEvents.system?.warningsAndErrors ?? 0;
          const evStr = `Application 로그: ${appC} 건, System 로그: ${sysC} 건 (기간: 최근 24시간, 심각도: 경고 및 오류)`;
          addDlRow('최근 Windows 이벤트 (System·Application)', evStr, true);
        } else {
          addDlRow('최근 Windows 이벤트 (System·Application)', '', false, d.winEvents?.error || '이벤트 로그 서비스 접근 실패', 'PowerShell에서 Get-Service EventLog 상태를 확인하세요.');
        }

        secContainer.append(dl);

        const cautionP = document.createElement('p');
        cautionP.textContent = '주의: 위 Windows 이벤트 건수는 일상적인 운영체제 백그라운드 이벤트이며, 외부 침입이나 보안 위협을 의미하지 않습니다.';
        cautionP.className = 'muted';
        secContainer.append(cautionP);
      };

      loadSecBtn.addEventListener('click', async () => {
        loadSecBtn.disabled = true;
        loadSecBtn.setAttribute('aria-busy', 'true');
        loadSecBtn.textContent = '⏳ 보안 구성 측정 중… (잠시만 기다려 주세요)';
        try {
          const res = await fetch('/api/pc-network-security');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          renderSecData(json);
        } catch (err) {
          secContainer.textContent = '';
          const p = document.createElement('p');
          p.className = 'state state-error';
          p.textContent = `[확인 불가] 네트워크·보안 정보 조회 실패`;
          const detail = document.createElement('p');
          detail.textContent = `- 실패한 항목: /api/pc-network-security 통신\n- 이유: ${err.message || '네트워크 연결 불가'}\n- 다음에 할 일: 앱 서버(5189 포트) 실행을 확인하고 「다시 조회」를 누르세요.`;
          secContainer.append(p, detail);
        } finally {
          loadSecBtn.disabled = false;
          loadSecBtn.removeAttribute('aria-busy');
          loadSecBtn.textContent = '네트워크 구성 및 방화벽·이벤트 실측 다시 조회';
        }
      });

      secSection.append(loadSecBtn);
      root.append(secSection);

      return root;
    },
    renderVulnerabilities({ status = 'idle', mode = null, data = null, error = null } = {}) {
      const root = document.createElement('div');
      root.className = 'student-box';

      const addLine = (text, parent = root, className = '') => {
        const line = document.createElement('p');
        line.textContent = text;
        if (className) line.className = className;
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

      // 1. status별 기본 상태 구분 (idle / loading / error / ok)
      if (status === 'idle') {
        addLine('조회 전(idle): 아직 패키지 조회를 실행하지 않았습니다. 제공 화면의 「설치 패키지 조회」를 누르세요.');
        return root;
      }

      if (status === 'loading') {
        addLine('조회 중(loading): 설치된 패키지 정보와 OSV 취약점 데이터베이스를 대조하고 있습니다…');
        return root;
      }

      if (status === 'error') {
        const errMsg = error?.message || (typeof error === 'string' ? error : '패키지 조회 요청이 처리되지 않았습니다.');
        const errCode = error?.code ? ` [${error.code}]` : '';
        addLine(`조회 실패: ${errMsg}${errCode}`, root, 'state state-error');
        addLine('안내: 이전 조회 결과는 현재 확인 결과가 아니므로 유지하지 않습니다. 필요하면 직접 다시 조회하세요.');
        return root;
      }

      if (status !== 'ok' || !data) {
        addLine('확인 불가: 패키지 조회 상태를 확인할 수 없습니다.');
        return root;
      }

      // 2. data.status (전체 조회 상태)
      const dataStatusLabels = {
        complete: '모두 조회(complete)',
        partial: '일부 조회 실패(partial)',
        not_checked: '아직 조회 안 함(not_checked)',
        not_configured: '프로젝트 설정 없음(not_configured)',
        unverifiable: 'lock 파일 확인 불가(unverifiable)',
      };
      const totalStatusText = dataStatusLabels[data.status] || `${data.status || '확인 불가'}(unknown)`;

      const header = document.createElement('h4');
      header.textContent = `전체 패키지 조회 상태: ${totalStatusText}`;
      root.append(header);

      if (data.status === 'not_configured') {
        addLine('안내: 조회 대상 프로젝트 설정이 필요하거나 승인된 공개 패키지 목록이 비어 있습니다(정상).');
      } else if (data.status === 'not_checked') {
        addLine('안내: 승인된 공개 조회 대상이 아직 조회되지 않았습니다.');
      } else if (data.status === 'partial') {
        addLine('주의: 일부 패키지의 조회가 실패했습니다. 성공한 패키지의 취약점 결과만 표시됩니다.');
      }

      // 3. 메타데이터 (lockfileVersion, lockfileHash, checkedAt)
      const metaSection = document.createElement('section');
      const dl = document.createElement('dl');
      const addDl = (term, desc) => {
        const dt = document.createElement('dt');
        dt.textContent = term;
        const dd = document.createElement('dd');
        dd.textContent = String(desc ?? '확인 불가');
        dl.append(dt, dd);
      };

      if (data.lockfileVersion !== undefined && data.lockfileVersion !== null) {
        addDl('lockfile 버전', data.lockfileVersion);
      }
      if (data.lockfileHash) {
        addDl('lockfile 해시', data.lockfileHash);
      }
      if (data.checkedAt) {
        addDl('확인 시각', data.checkedAt);
      }
      metaSection.append(dl);
      root.append(metaSection);

      // 4. packages 목록
      const packages = Array.isArray(data.packages) ? data.packages : [];
      const pkgSection = document.createElement('section');
      const pkgTitle = document.createElement('h5');
      pkgTitle.textContent = `설치 패키지 목록 (${packages.length}개):`;
      pkgSection.append(pkgTitle);

      if (packages.length === 0) {
        addLine('설치 패키지 목록이 비어 있거나 조회 대상이 없습니다.', pkgSection);
      } else {
        const pkgStatusLabels = {
          known_vulnerabilities: '알려진 항목 있음(known_vulnerabilities)',
          none_found: '알려진 항목 없음(none_found)',
          unverifiable: '조회 확인 불가(unverifiable)',
        };

        const table = document.createElement('table');
        table.className = 'student-table';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['패키지명', '설치 버전', '상태', '출처', '확인 시각', '취약점 목록'].forEach(col => {
          const th = document.createElement('th');
          th.textContent = col;
          headerRow.append(th);
        });
        thead.append(headerRow);
        table.append(thead);

        const tbody = document.createElement('tbody');
        for (const pkg of packages) {
          const tr = document.createElement('tr');
          if (pkg.name) tr.dataset.studentPackageName = pkg.name;
          if (pkg.version) tr.dataset.studentPackageVersion = pkg.version;

          // 패키지명
          const tdName = document.createElement('td');
          tdName.textContent = pkg.name || '알 수 없음';
          tr.append(tdName);

          // 설치된 정확한 버전 (범위 표현식 아님)
          const tdVersion = document.createElement('td');
          tdVersion.textContent = pkg.version || '확인 불가';
          tr.append(tdVersion);

          // 상태 표시
          const tdStatus = document.createElement('td');
          const stLabel = pkgStatusLabels[pkg.status] || `${pkg.status || '확인 불가'}`;
          const vulns = Array.isArray(pkg.vulnerabilities) ? pkg.vulnerabilities : [];

          if (pkg.status === 'unverifiable' && vulns.length > 0) {
            tdStatus.textContent = '일부 확인·전체 조회 확인 불가(unverifiable)';
          } else {
            tdStatus.textContent = stLabel;
          }
          tr.append(tdStatus);

          // 출처
          const tdSource = document.createElement('td');
          tdSource.textContent = pkg.source || '확인 불가';
          tr.append(tdSource);

          // 확인 시각
          const tdCheckedAt = document.createElement('td');
          tdCheckedAt.textContent = pkg.checkedAt || '확인 불가';
          tr.append(tdCheckedAt);

          // 취약점 세부 항목 (id, modified)
          const tdVulns = document.createElement('td');
          if (pkg.status === 'none_found') {
            tdVulns.textContent = '조회 범위에서 알려진 취약점 없음 (안전 보장 아님)';
          } else if (vulns.length === 0) {
            tdVulns.textContent = pkg.status === 'unverifiable' ? '취약점 여부 확인 불가' : '취약점 없음';
          } else {
            const ul = document.createElement('ul');
            for (const v of vulns) {
              const li = document.createElement('li');
              const vId = v.id || 'ID 없음';
              const vMod = v.modified ? ` (수정: ${v.modified})` : '';
              li.textContent = `${vId}${vMod}`;
              ul.append(li);
            }
            tdVulns.append(ul);
          }
          tr.append(tdVulns);

          tbody.append(tr);
        }
        table.append(tbody);
        pkgSection.append(table);
      }
      root.append(pkgSection);

      addLine('주의: OSV는 알려진 취약점 데이터베이스이며, 결과가 없다는 사실만으로 해당 패키지나 앱 전체가 완전히 안전하다고 보장하지는 않습니다.', root, 'muted');

      return root;
    },
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
    renderAction(actionState) {
      const root = document.createElement('div');
      root.className = 'student-box';

      // 입력 데이터 분해
      const state = actionState || {};
      const status = state.status || 'idle';
      const event = state.event || null;
      const actionId = state.actionId || null;
      const target = state.target || null;
      const receipt = state.receipt || null;
      const observation = state.observation || null;
      const message = state.message || '';
      const confirmationExpiresAt = state.confirmationExpiresAt || null;
      const error = state.error || null;

      // 바깥 요소에 계약 속성 바인딩
      if (event && event.id) {
        root.dataset.studentActionEvent = event.id;
      }
      if (receipt && receipt.requestId) {
        root.dataset.studentActionRequest = receipt.requestId;
      }

      const addLine = (text, parent = root, className = '') => {
        const p = document.createElement('p');
        p.textContent = text;
        if (className) p.className = className;
        parent.append(p);
      };

      // 1. 상태(status)별 안내 문구
      const statusHeader = document.createElement('h4');
      statusHeader.textContent = '보안 조치 처리 상태:';
      root.append(statusHeader);

      if (status === 'idle') {
        addLine('아직 미실행(idle): 조치 제안은 아직 실행되지 않았습니다.');
      } else if (status === 'loading') {
        addLine('조치 준비 또는 결과 조회 중(loading) · 완료 아님');
      } else if (status === 'prepared') {
        addLine('준비됨·미실행(prepared): 조치가 준비되었으나 아직 실행되지 않았습니다. 대상과 기한을 확인하세요.');
        if (confirmationExpiresAt) {
          addLine(`확인 기한: ${confirmationExpiresAt}`);
        }
        addLine('안내: 제공 화면의 확인 버튼을 눌러 승인해야 집행 단계로 진행됩니다.');
      } else if (status === 'executing') {
        addLine('서버에 전달 중(executing) · 결과 미확인 / 완료 아님');
      } else if (status === 'pending') {
        addLine('서버 접수·처리 중(pending) · 서버가 요청을 접수(ACK)했으나 실제 조치 효과는 아직 확인되지 않았습니다(완료 아님).');
      } else if (status === 'succeeded') {
        // succeeded이면서 observation.effectApplied === true일 때만 효과 확인으로 표시
        if (observation && observation.effectApplied === true) {
          addLine('효과 확인(succeeded): 연동 시스템에서 실제 조치 효과가 확인되었습니다.');
          addLine(`effectApplied: true`);
          if (observation.observedAt) {
            addLine(`관측 시각: ${observation.observedAt}`);
          }
          if (receipt?.receiptId) {
            addLine(`접수 영수증(receiptId): ${receipt.receiptId}`);
          }
        } else {
          // effectApplied가 true가 아니면 효과 없음/성공으로 단정하지 않고 결과 불명으로 처리
          addLine('결과 불명(unknown): 연동 시스템에서 실제 효과가 확인되지 않았습니다. 효과 없음으로도 성공으로도 단정하지 마시고 결과만 재조회하십시오.');
        }
      } else if (status === 'denied') {
        addLine(`거절(denied): 연동 시스템에서 조치를 거절했습니다. ${message || ''}`);
      } else if (status === 'failed') {
        addLine(`실패(failed): 연동 시스템에서 조치 처리에 실패했습니다. ${message || ''}`);
      } else if (status === 'unknown') {
        addLine('결과 불명(unknown): 효과 없음으로도 성공으로도 단정하지 마십시오. 연동 시스템 결과만 재조회하십시오.');
      } else if (status === 'expired') {
        addLine('확인 기한 지남(expired): 사람 확인 기한이 지났습니다. 이번 준비로는 집행할 수 없으니 다시 준비하십시오.');
      } else if (status === 'error') {
        const errCode = error?.code || 'ACTION_ERROR';
        const errMsg = error?.message || message || '요청이 처리되지 않았습니다.';
        addLine(`요청 처리 실패(error): [${errCode}] ${errMsg}`);
      } else {
        addLine(`확인 불가 상태(${status}) · 결과만 재조회하십시오.`);
      }

      // 부가 메시지가 있고 본문과 겹치지 않으면 표시
      if (message && status !== 'denied' && status !== 'failed' && status !== 'error') {
        addLine(`안내 메시지: ${message}`);
      }

      // 2. 조치 및 대상 식별 정보 (있는 것만 표시)
      const detailsSection = document.createElement('section');
      const detailsTitle = document.createElement('h5');
      detailsTitle.textContent = '조치 세부 정보:';
      detailsSection.append(detailsTitle);

      const dl = document.createElement('dl');
      const addDl = (term, desc) => {
        const dt = document.createElement('dt');
        dt.textContent = term;
        const dd = document.createElement('dd');
        dd.textContent = String(desc);
        dl.append(dt, dd);
      };

      let hasDetails = false;
      if (event && event.id) {
        addDl('사건 ID (event.id)', event.id);
        hasDetails = true;
      }
      if (event && Array.isArray(event.evidence) && event.evidence.length > 0) {
        const evIds = event.evidence.map(e => e.id).filter(Boolean).join(', ');
        if (evIds) {
          addDl('근거 ID (evidence)', evIds);
          hasDetails = true;
        }
      }
      if (actionId) {
        addDl('조치 ID (actionId)', actionId);
        hasDetails = true;
      }
      if (target) {
        if (target.id !== undefined && target.id !== null) {
          addDl('대상 ID (target.id)', target.id);
          hasDetails = true;
        }
        if (target.generation !== undefined && target.generation !== null) {
          addDl('대상 세대 (target.generation)', target.generation);
          hasDetails = true;
        }
      }
      if (receipt) {
        if (receipt.requestId) {
          addDl('요청 ID (requestId)', receipt.requestId);
          hasDetails = true;
        }
        if (receipt.receiptId) {
          addDl('영수증 ID (receiptId)', receipt.receiptId);
          hasDetails = true;
        }
        if (receipt.version !== undefined && receipt.version !== null) {
          addDl('버전 (version)', receipt.version);
          hasDetails = true;
        }
        if (receipt.superseded) {
          addLine('안내: 이전 조회는 최신 결과를 대신하지 않습니다(superseded).', detailsSection);
        }
      }

      if (hasDetails) {
        detailsSection.append(dl);
        root.append(detailsSection);
      }

      // 조치 버튼 및 확인 티켓 관련 안내 (학생 코드에서 생성하지 않음)
      const guidance = document.createElement('p');
      guidance.textContent = '안내: 조치 버튼 및 확인 승인은 제공 화면 버튼을 통해서만 수행되며, 학생 코드에서는 임의 조치 요청이나 티켓을 생성하지 않습니다.';
      guidance.className = 'muted';
      root.append(guidance);

      return root;
    },
  };

  // 접속 판정 요약: 이 화면에서 받은 판정만 센다. 새로고침하면 처음부터 다시 센다.
  // 같은 판정이 다시 그려져도 한 번만 세도록 (앱, 판정 시각)으로 구분한다.
  const tally = { allow: 0, deny: 0, challenge: 0, unknown: 0 };
  const counted = new Set();
  // 판정 사유 분포: 화면으로 오는 판정에는 reasonCode가 없고 사유 문장(reason)만 있어 문장 기준으로 센다.
  const reasonTally = new Map();
  const drawDecision = view.renderDecision;
  view.renderDecision = (args = {}) => {
    const { status, data, appId } = args;
    if (status === 'ok' && data?.checkedAt) {
      const key = `${data.appId || appId || ''}|${data.checkedAt}`;
      if (!counted.has(key)) {
        counted.add(key);
        const kind = Object.hasOwn(tally, data.decision) ? data.decision : 'unknown';
        tally[kind] += 1;
        const reason = typeof data.reason === 'string' && data.reason.trim() ? data.reason.trim() : '사유 정보 없음';
        const reasonKey = `${kind}|${reason}`;
        reasonTally.set(reasonKey, { kind, reason, count: (reasonTally.get(reasonKey)?.count ?? 0) + 1 });
      }
    }

    const root = drawDecision(args);
    const box = document.createElement('section');
    box.className = 'student-decision-summary';
    const title = document.createElement('h4');
    title.textContent = '접속 판정 요약';
    box.append(title);

    const total = counted.size;
    const lines = total === 0
      ? ['아직 받은 판정이 없습니다.']
      : [
        `허용(allow): ${tally.allow}건 · 거부(deny): ${tally.deny}건 · 추가 확인 필요(challenge): ${tally.challenge}건 · 확인 불가(unknown): ${tally.unknown}건`,
        `합계: ${total}건`,
      ];
    for (const text of lines) {
      const line = document.createElement('p');
      line.textContent = text;
      box.append(line);
    }
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = '안내: 이 화면에서 요청한 판정만 센 값이며 새로고침하면 초기화됩니다. 요청 실패와 확인 불가는 허용으로 세지 않습니다.';
    box.append(note);

    const reasonTitle = document.createElement('h5');
    reasonTitle.textContent = '판정 사유 분포';
    box.append(reasonTitle);
    if (reasonTally.size === 0) {
      const none = document.createElement('p');
      none.textContent = '아직 집계할 사유가 없습니다.';
      box.append(none);
    } else {
      const kindText = { allow: '허용', deny: '거부', challenge: '추가 확인 필요', unknown: '확인 불가' };
      const ul = document.createElement('ul');
      for (const item of [...reasonTally.values()].sort((a, b) => b.count - a.count)) {
        const li = document.createElement('li');
        li.textContent = `${item.reason} — ${item.count}건 (${kindText[item.kind]}, ${item.kind})`;
        ul.append(li);
      }
      box.append(ul);
    }
    root.append(box);
    return root;
  };

  // XDR 경보 현황: 보안 기록 중 kind가 'xdr'인 기록만 센다.
  // 기록을 받지 못했거나 형식을 알 수 없으면 "경보 없음"이 아니라 확인 불가로 표시한다.
  const drawEvents = view.renderEvents;
  view.renderEvents = (args = {}) => {
    const { status, data } = args;
    const root = drawEvents(args);
    const box = document.createElement('section');
    box.className = 'student-xdr-summary';
    const title = document.createElement('h4');
    title.textContent = 'XDR 경보 현황';
    box.append(title);

    const lines = [];
    if (status === 'loading') {
      lines.push('XDR 경보를 불러오는 중입니다.');
    } else if (status !== 'ok' || !Array.isArray(data)) {
      lines.push('확인 불가: 보안 기록을 받지 못해 XDR 경보 건수를 알 수 없습니다. 경보 없음으로 간주하지 마세요.');
    } else {
      const alerts = data
        .filter((event) => event?.kind === 'xdr')
        .sort((a, b) => (Date.parse(b?.at) || 0) - (Date.parse(a?.at) || 0));
      if (alerts.length === 0) {
        lines.push('XDR 경보: 0건 (받은 기록 안에 XDR 경보가 없습니다)');
      } else {
        const latest = alerts[0];
        lines.push(`XDR 경보: ${alerts.length}건 (전체 기록 ${data.length}건 중)`);
        lines.push(`가장 최근 경보: ${latest.at || '시각 확인 불가'} · ID: ${latest.id || '확인 불가'} - ${latest.summary || '요약 없음'}`);
      }
    }
    for (const text of lines) {
      const line = document.createElement('p');
      line.textContent = text;
      box.append(line);
    }
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = '안내: 서버가 보낸 기록 중 XDR 경보만 센 값입니다. 0건은 이 기록 범위에서 없다는 뜻이며 안전 보장이 아닙니다.';
    box.append(note);
    root.prepend(box);

    // 날짜별 기록 추이: 기록 시각을 이 PC의 날짜로 묶어 최근 7일치 건수를 문자 막대로 보여 준다.
    const trend = document.createElement('section');
    trend.className = 'student-record-trend';
    const trendTitle = document.createElement('h4');
    trendTitle.textContent = '날짜별 기록 추이';
    trend.append(trendTitle);
    const trendLine = (text, className = '') => {
      const line = document.createElement('p');
      line.textContent = text;
      if (className) line.className = className;
      trend.append(line);
    };
    if (status === 'loading') {
      trendLine('기록을 불러오는 중입니다.');
    } else if (status !== 'ok' || !Array.isArray(data)) {
      trendLine('확인 불가: 보안 기록을 받지 못해 추이를 알 수 없습니다.');
    } else {
      const days = new Map();
      let noTime = 0;
      for (const event of data) {
        const time = Date.parse(event?.at);
        if (!Number.isFinite(time)) {
          noTime += 1;
          continue;
        }
        const day = new Date(time).toLocaleDateString('sv-SE');
        const entry = days.get(day) || { total: 0, xdr: 0 };
        entry.total += 1;
        if (event.kind === 'xdr') entry.xdr += 1;
        days.set(day, entry);
      }
      if (days.size === 0) {
        trendLine('시각이 있는 기록이 없어 추이를 그릴 수 없습니다.');
      } else {
        const rows = [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(-7);
        const ul = document.createElement('ul');
        for (const [day, entry] of rows) {
          const li = document.createElement('li');
          li.textContent = `${day} ${'█'.repeat(Math.min(entry.total, 20))} ${entry.total}건 (XDR ${entry.xdr}건)`;
          ul.append(li);
        }
        trend.append(ul);
        if (data.length < 5) trendLine('기록이 5건 미만이라 추이를 판단하기에는 부족합니다.', 'muted');
      }
      if (noTime > 0) trendLine(`시각을 알 수 없는 기록 ${noTime}건은 제외했습니다.`, 'muted');
    }
    box.after(trend);

    // 보호 현황의 최근 기록 3건이 쓸 수 있도록 받은 기록을 보관한다. 기록이 바뀐 때만 다시 그리게 한다.
    const signature = status === 'ok' && Array.isArray(data)
      ? JSON.stringify(data.map((event) => [event?.id, event?.at, event?.kind]))
      : String(status);
    if (signature !== recentRecords.signature) {
      recentRecords.signature = signature;
      recentRecords.status = status;
      recentRecords.data = status === 'ok' && Array.isArray(data) ? data : null;
      if (typeof onChange === 'function') queueMicrotask(onChange);
    }
    return root;
  };

  // 최근 보안 기록 3건: 보호 현황(renderStatus) 아래에 붙인다.
  const recentRecords = { signature: null, status: null, data: null };
  const drawStatus = view.renderStatus;
  view.renderStatus = (args = {}) => {
    const root = drawStatus(args);

    // 기기·세션 이상 요약: 기준 충족 기기와 활성 세션이 아닌 것만 모은다. 받지 못한 자료는 "이상 없음"이 아니라 확인 불가로 둔다.
    const issueBox = document.createElement('section');
    issueBox.className = 'student-device-session-issues';
    const issueTitle = document.createElement('h4');
    issueTitle.textContent = '기기·세션 이상 요약';
    issueBox.append(issueTitle);
    const issueLine = (text, className = '') => {
      const line = document.createElement('p');
      line.textContent = text;
      if (className) line.className = className;
      issueBox.append(line);
    };
    const deviceText = { noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
    const sessionText = { expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
    const issues = [];
    const unreadable = [];
    for (const [name, resource, labels, okStatus] of [
      ['기기', args.devices, deviceText, 'compliant'],
      ['세션', args.sessions, sessionText, 'active'],
    ]) {
      if (resource?.status === 'loading') {
        unreadable.push(`${name} 정보를 불러오는 중`);
      } else if (resource?.status !== 'ok' || !Array.isArray(resource.data)) {
        unreadable.push(`${name} 정보를 확인할 수 없음`);
      } else {
        for (const item of resource.data) {
          if (item?.status === okStatus) continue;
          const label = labels[item?.status] || '확인 불가';
          issues.push(`${name}: ${item?.label || item?.id || '이름 확인 불가'} · ${label}(${item?.status || 'unknown'})`);
        }
      }
    }
    if (issues.length > 0) {
      issueLine(`이상 ${issues.length}건`);
      const ul = document.createElement('ul');
      for (const text of issues) {
        const li = document.createElement('li');
        li.textContent = text;
        ul.append(li);
      }
      issueBox.append(ul);
    }
    if (unreadable.length > 0) {
      issueLine(`확인 불가: ${unreadable.join(', ')}. 이상 없음으로 간주하지 마세요.`);
    } else if (issues.length === 0) {
      issueLine('이상 0건: 받은 기기와 세션이 모두 기준 충족·활성입니다.');
    }
    root.append(issueBox);

    const box = document.createElement('section');
    box.className = 'student-recent-records';
    const title = document.createElement('h4');
    title.textContent = '최근 보안 기록 3건';
    box.append(title);

    const addLine = (text, className = '') => {
      const line = document.createElement('p');
      line.textContent = text;
      if (className) line.className = className;
      box.append(line);
    };
    if (recentRecords.status === 'loading' || recentRecords.status === null) {
      addLine('보안 기록을 불러오는 중이거나 아직 받지 못했습니다.');
    } else if (!recentRecords.data) {
      addLine('확인 불가: 보안 기록을 받지 못했습니다. 기록 없음으로 간주하지 마세요.');
    } else if (recentRecords.data.length === 0) {
      addLine('표시할 보안 기록이 없습니다.');
    } else {
      const kindText = { access: '접속', xdr: 'XDR 경보' };
      const ul = document.createElement('ul');
      const latest = [...recentRecords.data]
        .sort((a, b) => (Date.parse(b?.at) || 0) - (Date.parse(a?.at) || 0))
        .slice(0, 3);
      for (const event of latest) {
        const li = document.createElement('li');
        li.textContent = `[${kindText[event?.kind] || event?.kind || '종류 확인 불가'}] ${event?.at || '시각 확인 불가'} · ${event?.id || 'ID 확인 불가'} - ${event?.summary || '요약 없음'}`;
        ul.append(li);
      }
      box.append(ul);
      addLine('자세한 근거와 상세는 보안 기록 탭에서 확인하세요.', 'muted');
    }
    root.append(box);
    return root;
  };
  return view;
}
