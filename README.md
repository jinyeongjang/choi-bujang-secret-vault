# 내 보안 Agent 시작 틀 0.2.11

이 보안 Agent는 회사 직원이 자기 로그인 상태, 업무 앱 접속 결과, 최근 접속 기록과 보안 경보를 보는 보안 앱입니다. 13단계부터 22단계까지 이 프로젝트 하나로 화면을 채워 가며 완성합니다. 처음이라면 docs/GETTING_STARTED_STUDENT.md부터 읽습니다. 무엇을 왜 만드는지와 단계별 순서가 그 문서에 있습니다.

이 시작 틀을 받은 것만으로 단계를 통과하지 않습니다. 단계마다 docs/STUDENT_PROMPTS.md의 안내를 수업용 AI에 붙여 넣어 student/extension.mjs를 고치고, 화면에서 확인하고, 커밋한 뒤 ALEPH에 제출합니다. 제출하면 서버가 그 커밋의 코드를 받아 AI가 단계 과제 기준으로 읽고 판정합니다. 코드를 실행해서 판정하지 않습니다.

## 켜기

검수 환경은 Node.js 22~24(수업 기준 24.19.0)이며 클라이언트 실행에는 외부 npm 의존성이 없습니다. 이 폴더의 PowerShell에서 아래를 실행하고 PC 브라우저로 http://127.0.0.1:5189 를 엽니다. 자세한 켜기·끄기·다시 켜기는 docs/STUDENT_LAUNCH_GUIDE.md에 있습니다.

    powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1

npm start도 같은 서버를 켭니다. 기본 실행은 실제 회사 시스템(기존 엔진)에 연결되지 않은 상태입니다. npm run demo는 예제 자료로 화면을 보여 줄 뿐이며 실제 연결이나 성취가 아닙니다. npm run check는 student/extension.mjs의 문법만 확인합니다.

## 지킬 것

- 기존 1~3차 프로젝트와 학생 파일은 지우거나 덮어쓰지 않습니다. 새 폴더에서 시작하거나, 이미 하던 프로젝트를 이어 씁니다.
- AI 열쇠·비밀번호·토큰을 코드, 커밋, 캡처, 도움정보에 넣지 않습니다. 주소나 열쇠를 직접 입력하는 칸도 만들지 않습니다.
- .env.example에는 비밀 없는 설정만 있습니다.

## 더 읽을 곳

- 단계별 안내와 AI에 붙여 넣을 문장: docs/STUDENT_PROMPTS.md
- 단계별 확인 항목: docs/CURRICULUM.json, docs/IMPLEMENTATION_CONTRACT.md
- 오류 코드별 해결: docs/CONNECTION_TROUBLESHOOT.md
- 시작 틀 업데이트(내 파일 보존): docs/STARTER_UPDATE.md
- 실제 회사 시스템(SDP)·앱 안 AI 연결은 담당자가 따로 안내할 때만 씁니다: docs/SDP_HOST_CONNECTION.md, docs/AI_SETUP_GUIDE.md. 이 연결은 앱을 처음 켜고 13~16단계 화면을 만들거나 공식 AI 코드 판정을 받기 위한 전제 조건은 아닙니다. 다만 17단계 이후의 실제 연결과 새 환경 재현은 해당 단계의 기준에 따라 따로 확인합니다.

---

## 보안 Agent 「쉴더스진」 프로젝트 안내

### 1. 프로젝트 목적 및 제품 범위
제로 트러스트 원칙에 기반하여 사내 임직원의 단말 상태, 로그인 식별 정보, 업무 시스템 접근 판정, XDR 보안 경보 및 AI 기반 보안 위험 설명을 가시화하고 즉각적인 조치 및 의존성 취약점 점검을 수행하는 엔드포인트 보안 클라이언트입니다.

- **보안 Agent 클라이언트 (13~22단계)**: `src/server.mjs`, `src/*`, `public/*`, `student/extension.mjs`, `student/engine-adapter.mjs`로 구성되며, 외부 패키지 설치 없이 Node.js 표준 모듈(루프백 http://127.0.0.1:5189)로 독립 실행됩니다.
- **백엔드 API 및 검증 모듈 (1~12단계)**: `api/notes.js`, `api/threat-intel.js`, `src/verify-login.mjs` 등 Vercel 서버리스 및 인증 모듈은 `@supabase/supabase-js` (^2.117.2) 및 `jose` (^6.2.12) 패키지에 의존하며 `package-lock.json` 및 `package.json` dependencies에 정의되어 있습니다.

### 2. 주요 구현 기능 (학생 구현: `student/extension.mjs`)
- **사용자 및 기기 식별 (13단계)**: 로그인 사용자, 등록 기기 및 활성 세션 상태 표출
- **업무 앱 접속 판정 (14단계)**: 허용(allow), 거부(deny), 추가 확인(challenge), 확인 불가(unknown) 판정 구분
- **XDR 보안 이벤트 및 근거 (15단계)**: 보안 사건 상세 정보, 위반 규칙 및 이벤트 상태 렌더링
- **상태 정리 및 진단 (16단계)**: 기기·세션 목록, 시스템 알림, 진단 정보 및 빈 상태 안내
- **앱 내부 AI 연결 관리 (17단계)**: AI 연결 라이프사이클 및 승인 진행 상태 추적
- **AI 보안 설명 (18단계)**: 보안 사건에 대한 AI 검증 근거와 위험도 설명 분리 표출
- **보안 조치 실행 (19단계)**: 격리, 차단 등 조치 요청 상태와 실제 처리 결과 구분
- **패키지 취약점 진단 (20단계)**: 의존성 패키지 스캔 및 알려진 CVE/GHSA 취약점 목록 표시

### 3. 시스템 구성 및 코드 경계
- **브라우저 클라이언트**: `public/index.html`, `public/app.js` (제공), `student/extension.mjs` (학생 구현)
- **로컬 앱 서버**: `src/server.mjs` (제공, 루프백 http://127.0.0.1:5189)
- **접근 제어 및 XDR 엔진 어댑터**: `src/engine.mjs` (제공), `student/engine-adapter.mjs` (제공, 시작 틀 매니페스트 해시 일치), `src/actions/` (제공)
- **AI 게이트웨이 연동**: `src/ai/service.mjs`, `vendor/clco-http.mjs` (제공)

### 4. 지원 환경 및 버전
- **Node.js 지원 범위**: `Node.js 22 ~ 24` (`>=22.0.0 <=24.x`, `package.json` engines 및 실행 도구 일치)
- **수업 기준 및 권장 버전**: `v24.19.0` (LTS)
- **실제 확인 버전**: `v24.13.0`
- **npm**: 11.6.2 (실제 확인)
- **상세 실행 설명서**: 상세 설치·실행 순서, 시스템 구성도, 매니페스트 기준 제공/학생 코드 경계, 취약점 스캐너 오류별 복구 방법 및 지원 범위는 [docs/STUDENT_RUNBOOK.md](docs/STUDENT_RUNBOOK.md)에 상세히 기술되어 있습니다.
- **새 환경 재현 및 릴리스 기록 (22단계)**: 별도 빈 폴더에서의 설치·실행 재현 절차, 13~21단계 누적 기능 재현 결과, 데이터 보존 계획 및 검증 중인 버전(v0.2.11-student-verified) 기록은 [docs/REPRODUCTION_REPORT.md](docs/REPRODUCTION_REPORT.md)를 참고하십시오.

### 5. 로컬 검증 어댑터 및 Windows 설치 관리자 (`ShieldusJin-Setup.exe`)
- **로컬 보안 엔진 어댑터 (`student/local-engine-adapter.mjs`)**: 외부 원격 SDP 호스트가 없는 환경에서도 제로 트러스트 계약(로그인 정보, 등록 단말, 활성 세션, 업무 앱 접속 판정, XDR 보안 이벤트 타임라인)을 완전하게 로컬에서 연동 및 검증할 수 있도록 지원합니다.
- **로컬 실행 명령어**:
  ```powershell
  $env:ON_ENGINE_ADAPTER = "student/local-engine-adapter.mjs"; node src/server.mjs
  ```
- **Windows 단독 설치 프로그램**: Inno Setup 7 기반 파이프라인(`installer/ShieldusJin-Setup.iss`)을 통해 컴파일된 `Output/ShieldusJin-Setup.exe`를 제공하며, 바탕화면 바로가기 및 `Run-ShieldusJin.bat`을 통해 자동 환경변수 구성 및 원클릭 브라우저 연동 실행을 지원합니다.

