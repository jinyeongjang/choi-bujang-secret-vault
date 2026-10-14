# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 2단계: 서버 함수(/api/notes)를 통한 자료 분리

### 현재 작동하는 기능
- 정적 파일(`public/data.json`)에서 가상 메모 문장을 제거하고 Supabase 테이블(`notes`)로 분리했습니다.
- Vercel 서버리스 함수(`api/notes.js`)가 서버 환경변수(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`)를 통해 데이터베이스에 접근하여 가상 메모 네 건을 읽어 반환합니다.
- 웹 화면(`public/index.html`)은 정적 파일 대신 서버 함수(`/api/notes`)를 비동기 호출하여 메모 목록을 표시합니다.
- `SUPABASE_SECRET_KEY`는 서버 환경에서만 참조되며 브라우저 정적 파일, HTTP 응답, 콘솔 로그에 일체 노출되지 않습니다.

### 현재 구조의 취약점 (약점)
- **공개 주소(Public Endpoint) 노출**: 현재 `api/notes.js` 서버 함수는 로그인 확인이나 토큰 검증 없이 요청을 처리하는 **공개 주소** 상태입니다. 방문자 또는 외부 공격자가 주소(`/api/notes`)를 알면 비로그인 상태에서도 가상 메모를 조회할 수 있는 취약점이 남아 있으며, 이후 단계에서 ZTNA/토큰 기반 검증을 추가해야 합니다.

### 설정 및 다시 실행하는 방법
1. Supabase **SQL Editor**에서 `schema.sql`을 실행하여 `notes` 테이블 및 RLS 설정을 완료하고 가상 메모를 삽입합니다.
2. Vercel 프로젝트 설정(**Settings** -> **Environment Variables**)에서 환경변수 등록:
   - `SUPABASE_URL`: 프로젝트 URL
   - `SUPABASE_SECRET_KEY`: `service_role` 비밀키 (절대 외부에 공개하지 마세요)
3. 로컬 빌드 검증:
   ```bash
   npm run build -- --local
   ```
4. Git 커밋 후 Vercel에 배포하여 웹 화면(`/`) 및 `/api/notes` 응답을 확인합니다.

### 가상 메모 문장 검색 확인 절차 및 과거 노출 주의사항

1. **GitHub 최신 파일(HEAD) 검색 확인**:
   - 최신 커밋 기준으로 정적 파일 및 소스 코드에 가상 메모 문장이 남아있는지 검색합니다.
   ```bash
   git grep "실습용 가상" HEAD
   ```
   - **정상 결과**: 데이터 이전용 스크립트인 `schema.sql` 외에는 `data.json`, `public/data.json`, `public/index.html` 등의 정적 파일이나 코드에서 검색 결과가 없어야 합니다.

2. **현재 Vercel 배포 정적 파일 검색 확인**:
   - 배포된 사이트의 공개 정적 파일(`/data.json`)을 비로그인으로 직접 호출하여 메모 문장 포함 여부를 검사합니다.
   ```bash
   curl -s https://<본인-배포-주소>.vercel.app/data.json
   ```
   - **정상 결과**: `{"sampleMarker":"SAMPLE_NOTE_1","notes":[]}`와 같이 메모가 비어 있어 검색 문장이 나타나지 않아야 합니다.

3. **과거 노출 관련 주의사항**:
   - **과거 노출 미해소 경고**: 현재 최신 커밋의 정적 파일과 새 배포에서 가상 메모 문장을 비웠더라도, **GitHub의 과거 공개 커밋 이력(Git Commit History)과 Vercel의 이전 배포(Past Deployments) 본이 남아 있는 한 과거의 자료 노출이 완전히 해소된 것은 아닙니다.** 공개 저장소와 배포 플랫폼 특성상 과거 커밋 및 과거 배포 주소를 통해 이전 상태를 열람할 수 있으므로, 실제 환경에서는 이력 파기와 키 폐기 등의 후속 조치가 필요함을 유의하세요.

## 3단계: 진짜 로그인 연동 및 토큰 기반 인가 제어

### 현재 작동하는 기능
- **토큰 검증**: 자료 API(`api/notes.js`, `api/notes/[id].js`)가 시작 틀의 `src/verify-login.mjs`(`createLoginVerifier`)를 사용하여 `Authorization: Bearer <token>`을 검증합니다.
- **비로그인 및 비인가 요청 차단**: 유효한 토큰이 없거나 검증에 실패하면 자료를 반환하지 않고 `401 Unauthorized`로 즉시 거부합니다.
- **브라우저 사용자 정보 불신**: 브라우저가 전달한 임의의 `userId`, `role` 등 클라이언트 주장은 신뢰하지 않고, 암호학적으로 검증된 서버의 `identity.userId`만 사용합니다.
- **가상 메모 CRUD API**:
  - `POST /api/notes`: `{id, title, body}` 수신 (id 누락 시 서버가 UUID 생성하여 `{id}` 반환, 서버 검증 사용자 ID를 `owner_id`로 저장).
  - `GET /api/notes`: 로그인 사용자의 메모 배열 반환.
  - `GET /api/notes/:id`: 단건 조회 시 `{id, title, body}` 반환 (삭제 후 조회 시 `404 Not Found`).
  - `PUT /api/notes/:id`: `{title, body}` 수정 및 갱신된 메모 반환.
  - `DELETE /api/notes/:id`: 단건 삭제 수행 (삭제 완료 후 후속 조회 시 404 반환).
- **허용 경로 등록**: `aleph.config.json`의 `allowedRoutes`에 `["/api/notes", "/api/notes/:id"]` 등록.
- **웹 화면 CRUD UI**: `public/index.html`에 메모 추가 폼과 목록 내 인라인 수정/삭제 버튼 제공, Supabase 세션 토큰을 `Authorization: Bearer` 헤더로 자동 첨부.
- **보안 헤더 적용**: `vercel.json`의 `headers` 설정에 `X-Content-Type-Options: nosniff`를 등록하여 첫 화면(`/`) 및 전체 응답에 보안 헤더를 적용했습니다.
- **JSON 에러 응답**: 비로그인 또는 비인가 요청 시 빈 화면이나 HTML이 아닌 `401 Unauthorized` 상태 코드와 JSON 에러 문구(`{"error":"UNAUTHORIZED"}`)를 반환합니다.
- **환경변수 자동 적용**:
  - `SUPABASE_URL`: 서버 런타임(`api/notes.js`)에서 읽어 DB 접속 및 `identityProvider` 발급자/JWKS 설정에 동적 적용하며, Vercel 배포 빌드 시 화면(`public/index.html`)에 자동 주입합니다.
  - `SUPABASE_SECRET_KEY`: 서버 런타임에서 `createLoginVerifier` 검증 및 DB 접근용으로 참조합니다.
  - `SUPABASE_ANON_KEY`: Vercel 배포 빌드 시 `public/index.html`의 공개 키 변수에 자동 주입합니다.
  - 로컬 개발 지원: `.env` 파일이 존재할 경우 `api/notes.js`가 자동으로 파싱하여 로드합니다.

### 3단계 취약점 해소 안내
- 3단계에서 존재했던 객체 수준 인가 부재(타인 메모 조회/수정/삭제 가능) 취약점은 4단계에서 API 및 DB RLS 정책을 통해 완전히 해소되었습니다.

## 4단계: 로그인해도 내 자료만 보이게 합니다 (객체 수준 인가 및 DB RLS 적용)

### 현재 작동하는 기능
- **객체 수준 인가 검사**: 개별 메모 단건 조회(`GET /api/notes/:id`), 수정(`PUT /api/notes/:id`), 삭제(`DELETE /api/notes/:id`) 시 DB의 `owner_id`와 요청자의 검증된 `identity.userId`를 대조하여 본인 소유의 메모만 허용하고, 타인 메모 접근 시 `403 Forbidden` (`{"error":"FORBIDDEN"}`)으로 차단합니다.
- **클라이언트 소유자 ID 불신**: 메모 추가(`POST /api/notes`) 시 URL이나 본문에 임의의 `owner_id`가 전달되더라도 이를 무시하고 서버가 암호학적으로 검증한 `identity.userId`로만 저장합니다.
- **수정/삭제 무결성 보장**: 단건 수정 시 기존 행과 갱신될 행의 소유자가 모두 본인인지 검증하며, 삭제 시에도 본인 소유 메모만 삭제를 허용합니다. 한 건 응답은 `{id, title, body}`, 수정 요청 본문은 `{title, body}`를 유지합니다.
- **허용 경로 등록**: `aleph.config.json`의 `allowedRoutes`에 실제 HTTP 메서드와 경로(`GET /api/notes`, `POST /api/notes`, `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`)를 명시했습니다.
- **학습 DB 최소 권한 및 RLS 정책 (`step4-rls.sql`, `schema.sql`)**:
  - `notes` 테이블에 Row Level Security(RLS)를 활성화하고, `PUBLIC, anon, authenticated`의 모든 권한을 회수한 뒤 `authenticated`에게만 `SELECT, INSERT, UPDATE, DELETE` 권한을 부여했습니다.
  - 행 단위 정책으로 `SELECT`와 `DELETE`는 `USING (auth.uid() = owner_id)`, `INSERT`는 `WITH CHECK (auth.uid() = owner_id)`, `UPDATE`는 `USING`과 `WITH CHECK` 모두 `auth.uid() = owner_id`를 적용하여 데이터베이스 계층에서도 내 자료만 접근 가능하도록 강제했습니다.

### 다시 실행하는 방법
1. Supabase **SQL Editor**에서 `step4-rls.sql`을 실행하여 RLS 활성화, 최소 권한 회수/부여, 4대 정책을 적용합니다.
2. `step4-seed.sql`에서 사용자 A와 B의 이메일을 입력 후 실행하여 소유권이 분리된 가상 메모를 준비합니다.
3. 로컬 테스트 및 빌드 검증:
   ```bash
   npm run test:r5
   npm run bundle
   ```

## 5단계: 자료 요청을 서버 한곳으로 모읍니다 (BFF 패턴 및 원본 자료 직접 접근 차단)

### 현재 작동하는 기능
- **단일 접점 집중 (BFF 패턴)**: 브라우저 클라이언트가 데이터베이스(Supabase)에 직접 쿼리를 날리지 않고, 모든 메모 조회·추가·수정·삭제 요청을 서버리스 함수(`/api/notes`, `/api/notes/:id`) 한곳으로 모아 처리합니다.
- **원본 자료 직접 권한 완전 회수 (`step5-revoke.sql`)**: 학습용 메모 테이블(`notes`)에 대해 `PUBLIC`, `anon`, `authenticated`의 모든 직접 테이블 권한을 회수(`REVOKE ALL`)하여, 외부 및 브라우저에서 Supabase REST API(`.../rest/v1/notes`)로 직접 접근하는 경로를 원천 차단했습니다.
- **서버 전용 권한 및 인가 유지**: 서버 함수는 환경변수(`SUPABASE_SECRET_KEY`, `service_role` 키)를 통해 데이터베이스에 안전하게 접근하며, 토큰 검증(`Authorization: Bearer`) 및 객체 수준 소유자 검증(`owner_id === identity.userId`)을 엄격히 유지합니다.
- **원본 자료 경로 등록**: `aleph.config.json`의 `originalApiUrl`에 쿼리가 없는 원본 자료 HTTPS 경로(`https://rumiyxkamhgodrrdvvft.supabase.co/rest/v1/notes`)를 명시했습니다.

### 다시 실행하는 방법
1. Supabase **SQL Editor**에서 `step5-revoke.sql`을 실행하여 `notes` 테이블의 `PUBLIC, anon, authenticated` 직접 권한을 회수합니다.
2. 로컬 테스트 및 빌드 검증:
   ```bash
   npm run test:r5
   npm run bundle
   ```

## 6단계: 등록한 기기만 자료실에 들어옵니다 (기기 등록 기반 판정 규칙)

### 현재 작동하는 기능
- **판정기 기기 검증 (`src/decider.mjs`)**:
  - `RULE_IDS`에 `device_registered` 규칙을 등록했습니다.
  - 요청의 `request.deviceRegistered`가 `true`인 경우에만 `decision: 'allow'`, `reasonCode: 'approved'`로 승인합니다.
  - 기기가 미등록 상태(`false`)이거나 값이 누락된 경우 `decision: 'deny'`, `reasonCode: 'device_not_registered'`로 접근을 거부합니다.

### 확인 순서
> [!NOTE]
> 이번 과정에서는 별도의 접속 프로그램을 로컬에 설치하지 않으며, 미등록 기기 접근 차단 시험은 심판이 원격에서 직접 수행합니다.

1. 로컬 판정기 가상 요청 검증을 실행합니다:
   ```bash
   npm run decider:test
   ```
2. 검증 항목별 결과를 확인합니다:
   - **등록 기기의 정상 요청**: `allow` 및 `ruleIds: ['device_registered']`로 통과 (`통과 · 등록 기기의 정상 요청`).
   - **미등록 기기의 가상 요청**: `deny` 및 `reasonCode: 'device_not_registered'`로 차단 (`통과 · 미등록 기기의 가상 요청`).
   *(주의: 이 명령은 로컬 가상 요청 기반의 사전 연습이며 실제 심판 접수 판정 증거가 아닙니다.)*

## 7단계: 평소와 다른 접속은 다시 확인합니다 (복합 이상 접속 및 추가 확인 판정 규칙)

### 현재 작동하는 기능
- **가상 접속 신호 및 출처 검증 (`src/decider.mjs`)**:
  - 엔진이 전달한 `request.signals`(`source`, `region`, `network`, `hour`) 및 `request.recentEvents`를 검사하며, 정보가 누락되거나 출처가 불명확한 경우 임의의 기본값으로 채우지 않고 계약 그대로 안전하게 해석합니다.
- **복합 이상 징후 판별 및 추가 확인(`step_up`) 요청**:
  - `RULE_IDS`에 `step_up_required` 규칙을 추가했습니다.
  - 평소와 다른 시각(심야/새벽) + 낯선 네트워크(`network !== 'usual'`) + 대량/위험 자료 열람 사건(`recentEvents`)이 복합적으로 발생할 경우 지역(`region`) 단독 영구 차단 대신 `decision: 'step_up'`, `reasonCode: 'step_up_required'`로 추가 확인을 요청합니다.
  - 추가 인증이 검증된 요청(`request.stepUp?.verified === true` 및 유효 시간 내)은 정상 승인(`decision: 'allow'`, `reasonCode: 'approved'`)합니다.
  - 기존 6단계 등록 기기 검증(`deviceRegistered: true`) 규칙을 유지하여 미등록 기기는 계속 `deny`로 차단합니다.
- **제공 엔진 계약 확인 및 실제 차단 보존 (`src/attack-check.mjs`)**:
  - 제공 엔진 계약(`docs/DECIDER_REQUEST.md`) 상 동일 사용자의 재로그인 시각 확인 계약이 없음을 확인했습니다.
  - 실제 자료실 차단은 억지로 연결하지 않고 `미실행` 상태로 안전하게 보존했습니다.

### 확인 순서 및 다시 실행하는 방법
1. 로컬 판정기 단위 검증을 실행합니다:
   ```bash
   npm run decider:test
   ```
2. 검증 항목별 결과를 확인합니다:
   - **등록 기기의 정상 요청**: `통과 · 등록 기기의 정상 요청` (`allow`)
   - **미등록 기기의 가상 요청**: `통과 · 미등록 기기의 가상 요청` (`deny`, 사유: `device_not_registered`)
   - **복합 이상 접속**: `통과 · 복합 이상 접속` (`step_up`, 사유: `step_up_required`)
   - **다시 확인한 복합 이상 접속**: `통과 · 다시 확인한 복합 이상 접속` (`allow`)
3. 가상 사건 규칙 시험을 실행합니다:
   ```bash
   npm run fixture:7
   ```
   - **정상 사건**: `allow`
   - **복합 이상 사건**: `step_up`

## 8단계: 자료마다 갈 수 있는 구역을 나눕니다 (자원 ID 표시 및 구역 분리 규칙)

### 현재 작동하는 기능
- **화면 자원 ID 표시 및 구역 구분 (`public/index.html`)**:
  - 기존 메모 CRUD 기능, API 주소(`/api/notes`), 화면 메뉴 구조는 온전히 유지하면서 강사 공지 영역(`자원 ID: notices`)과 내 자료실 메모 영역(`자원 ID: notes`)에 각각 다른 자원 ID 배지 및 속성(`data-resource-id`)을 부여했습니다.
- **판정기 구역 및 경로 분리 규칙 (`src/decider.mjs`)**:
  - `RULE_IDS`에 `zone_isolation` 규칙을 등록했습니다 (`['device_registered', 'step_up_required', 'zone_isolation']`).
  - 엔진이 확인한 사용자·기기·메서드·경로를 바탕으로 메모 구역의 정상 요청은 승인합니다.
  - 강사 공지 구역에 대한 수정/생성/삭제 요청(`PUT`, `POST`, `PATCH`, `DELETE`)은 학생 권한으로 수행할 수 없으므로 `decision: 'deny'`, `reasonCode: 'notice_modification_forbidden'`으로 차단합니다.
  - `:id`와 같은 깊이에 위치한 기능 경로(예: `/notes/export` 등) 및 알 수 없는 경로는 `decision: 'deny'`, `reasonCode: 'unknown_route'`로 거부합니다.
  - 이전 6단계 기기 등록 검증 및 7단계 복합 이상 접속 추가 확인 규칙을 온전히 유지합니다.
- **자료 API 소유자 및 권한 검증 강화 (`api/notes.js`)**:
  - 요청 본문이나 쿼리에 포함된 클라이언트의 임의 `role` 주장(예: `role: 'instructor'`)을 신뢰하지 않고 즉시 403 Forbidden (`UNTRUSTED_ROLE_CLAIM`)으로 거부합니다.
  - 타인 소유 메모에 대한 단건 조회/수정/삭제 시 `NOT_OWNER` 사유를 남겨 차단하며, 소유자 변경 시도 및 공지 수정 시도도 각각 명확한 사유로 거부합니다.

### 확인 순서 및 다시 실행하는 방법
1. 로컬 판정기 단위 검증을 실행합니다:
   ```bash
   npm run decider:test
   ```
2. 검증 항목별 결과를 확인합니다:
   - **등록 기기의 정상 요청**: `통과 · 등록 기기의 정상 요청` (`allow`)
   - **미등록 기기의 가상 요청**: `통과 · 미등록 기기의 가상 요청` (`deny`, 사유: `device_not_registered`)
   - **복합 이상 접속**: `통과 · 복합 이상 접속` (`step_up`, 사유: `step_up_required`)
   - **다시 확인한 복합 이상 접속**: `통과 · 다시 확인한 복합 이상 접속` (`allow`)
3. 가상 사건 규칙 시험을 실행합니다:
   ```bash
   npm run fixture:7
   ```
   - **정상 사건**: `allow`, **복합 이상 사건**: `step_up`
4. 로컬 빌드를 검증합니다:
   ```bash
   npm run build -- --local
   ```

## 9단계: 도플갱어를 찾고 권한을 거둡니다 (가상 사건 탐지 및 권한 회수 제안)

### 현재 작동하는 기능
- **가상 사건 입력 정제 (`src/detect.mjs`)**:
  - 엔진이 제공한 가상 사건에서 가명 사용자(`identity.sub`, `subjectId`), 기기(`deviceId`, `device`), 요청 종류(`method`, `action`, `kind`), 판정(`decision`, `result`), 시각(`at`)만 추출합니다.
  - 메모 본문(`body`, `content`), 인증 토큰(`token`), 실명(`name`, `realName`) 등 민감 정보는 일체 저장하거나 로그로 출력하지 않고 배제합니다.
- **다량 조회 및 네트워크 복합 의심 탐지**:
  - 사용자별 10분 구간 내 `GET` 조회가 120건을 초과하고, 평소와 다른 네트워크(`network !== 'usual'`)가 함께 나타날 때만 의심으로 판별합니다.
  - 지역(`region`) 정보 하나만으로 확정하지 않으며, 120건 이하의 정상 사건이나 흩어진 조회는 `{ action: 'observe' }`를 반환하여 상태를 유지합니다.
- **가상 기기 한 개 한정 회수 제안 (`propose_revocation`)**:
  - 기존 판정기(`src/decider.mjs`)의 5개 필수 항목 응답 및 API 규격을 변경하지 않고, 별도 탐지 결과를 통해 확인된 가상 기기 1개와 이유 코드(`burst_read`)를 담은 회수 제안을 반환합니다.
  - 회수 API를 직접 만들거나 기기 권한을 임의로 변경하지 않으며, 실제 접속 회수 집행과 시간 판정은 심판이 확인합니다.

### 확인 순서 및 다시 실행하는 방법
1. 가상 사건 탐지 연습 시험을 실행합니다:
   ```bash
   npm run detect:test
   ```
2. 검증 항목별 결과를 확인합니다:
   - **정상 조회 30건**: `통과 · 정상 조회 30건` (`observe`)
   - **10분 안에 120건**: `통과 · 10분 안에 120건` (`observe`)
   - **10분 안에 121건**: `통과 · 10분 안에 121건` (`propose_revocation`, 사유: `burst_read`)
   - **폭주 조회 200건**: `통과 · 폭주 조회 200건` (`propose_revocation`, 사유: `burst_read`)
   - **서로 다른 사용자 각 100건**: `통과 · 서로 다른 사용자 각 100건` (`observe`)
   - **10분 밖으로 흩어진 조회 200건**: `통과 · 10분 밖으로 흩어진 조회 200건` (`observe`)
   *(주의: 이 시험은 가상 사건 연습이며 실제 운영 반 엔진의 사건 전달·접속 회수가 연결됐거나 심판 통과 증거가 아닙니다.)*

## 10단계: 백업에서 자료실을 되살립니다 (정책 차이 비교 및 비공개 가상 메모 단건 복원)

### 서비스 및 경로
- **서비스 (Service)**: `notes`
- **복원 경로 (Restore Route)**: `POST /api/notes/restore`

### 현재 작동하는 기능
- **안전 정책 사본 비교 및 사전 검증 (`src/restore.mjs`)**:
  - `diffPolicies(safePolicy, testPolicy)`: 침해 전 검증된 안전 정책 사본과 현재 시험 정책의 차이(추가/제거/수정된 규칙)만 계산하며, 사본이 없거나 검증 실패 시 실제 운영 정책을 건드리지 않고 즉시 중단합니다.
  - `restorePolicy(safePolicy, testPolicy, options)`: 복원할 버전과 변경 범위(추가/수정/삭제 규칙)가 실행 전에 명확히 표시(`dryRun: true`)되며, 다른 서비스 규칙과 감사 이력을 유실 없이 보존하면서 안전 정책 버전으로 되돌립니다.
- **비공개 가상 메모 사본 단건 복원 (`src/restore.mjs`, `api/notes.js`)**:
  - 복구 대상 한 건의 ID, 소유자(`owner_id`), 내용 해시(`contentHash`, SHA-256) 세 값이 사본과 모두 일치할 때만 그 한 건을 복원(upsert)하고, 다른 메모는 원본 그대로 유지합니다.
  - ID 불일치, 타인 소유자 위조(`NOT_OWNER`), 본문/해시 변조(`HASH_MISMATCH`) 발생 시 복원을 즉시 거부합니다.
- **전체 점검 및 차단 재작동 보장**:
  - 복원 실행 전 복원할 버전과 변경 범위가 사전에 표시됩니다.
  - 복구 대상 한 건의 ID·소유자·내용 해시가 사본과 같아야 복원됩니다.
  - B의 A 자료 요청은 다시 거부(`403 Forbidden`)되고 A의 정상 요청은 그대로 유지됩니다.
  - 자료와 정책이 복구된 후 이전에 막던 요청(타인 자료 접근, 미등록 기기 등)이 다시 정상 거부되는지 확인합니다.

### 다시 실행하는 방법
1. **10단계 전체 복원 검증 실행**:
   ```bash
   npm run restore:test
   ```
   - **정상 결과**:
     - 복원할 버전과 변경 범위 사전 표시 통과
     - 복구 대상 한 건의 ID·소유자·내용 해시 사본 대조 복원 통과 (세 값 일치 시만 단건 복원)
     - B의 A 자료 요청 재거부 및 A 정상 요청 유지 확인
     - 자료와 정책 복구 후 이전 차단 재작동 확인
2. **판정기 계약 및 규칙 점검**:
   ```bash
   npm run decider:test
   ```
   - **정상 결과**: `docs/DECIDER_REQUEST.md` 계약 필드만 사용하며 모든 가상 요청에 5개 필수 항목과 등록된 `RULE_IDS` 내 규칙으로 응답 통과.
3. **제출 묶음 생성 및 자체 점검**:
   ```bash
   npm run bundle
   ```
   - **정상 결과**: `artifacts/submission.json` 생성 완료 및 학생 자체 점검 통과.

### 복구 뒤 1~9단계 정상·금지 요청 재실행 순서

복구 완료 후 1~9단계의 정상 요청과 금지 요청을 다시 확인할 수 있는 실행 순서입니다. 직접 실행하지 않은 시험은 `미실행`으로 두고 결과를 꾸미지 않습니다.

1. **1~2단계: 정적 자료 분리 및 공개 노출 여부 점검**
   - **실행 명령**:
     ```bash
     curl.exe -s -i https://choi-bujang-secret-vault-jinyeong.vercel.app/data.json
     ```
   - **기대 결과**: 공개 `data.json`에서 가상 메모 문장이 노출되지 않아야 함 (빈 배열 또는 404).
   - **현재 상태**: 미실행 (재실행 전)

2. **3단계: 로그인 연동 및 비인가 요청 차단 점검**
   - **금지 요청 (비로그인 조회)**:
     ```bash
     curl.exe -s -i https://choi-bujang-secret-vault-jinyeong.vercel.app/api/notes
     ```
     - **기대 결과**: `401 Unauthorized` (`{"error":"UNAUTHORIZED"}`)로 거부.
     - **현재 상태**: 미실행 (재실행 전)
   - **정상 요청 (유효한 Bearer 토큰 첨부 조회)**:
     ```bash
     curl.exe -s -i -H "Authorization: Bearer <유효한_토큰>" https://choi-bujang-secret-vault-jinyeong.vercel.app/api/notes
     ```
     - **기대 결과**: `200 OK` 및 로그인 사용자의 메모 목록 반환.
     - **현재 상태**: 미실행 (학생/심판 토큰 확인 필요)

3. **4단계: 객체 수준 인가 및 소유자 대조 점검**
   - **금지 요청 (타인 메모 단건 조회·수정·삭제 또는 비로그인 접근)**:
     ```bash
     curl.exe -s -i https://choi-bujang-secret-vault-jinyeong.vercel.app/api/notes/00000000-0000-0000-0000-000000000001
     ```
     - **기대 결과**: 비로그인 시 `401 Unauthorized`, 타인 소유 메모 접근 시 `403 Forbidden` (`NOT_OWNER`).
     - **현재 상태**: 미실행 (재실행 전)
   - **정상 요청 (본인 소유 메모 단건 조회·수정·삭제)**:
     - **기대 결과**: `200 OK` 및 본인 메모 `{id, title, body}` 반환.
     - **현재 상태**: 미실행 (학생/심판 토큰 확인 필요)

4. **5단계: 원본 자료 API 직접 접근 차단 (BFF 패턴) 점검**
   - **금지 요청 (원본 Supabase REST API 직접 호출)**:
     ```bash
     curl.exe -s -i https://rumiyxkamhgodrrdvvft.supabase.co/rest/v1/notes
     ```
     - **기대 결과**: 직접 권한 회수(`REVOKE ALL`) 및 인증 부재로 직접 조회 차단(`401`).
     - **현재 상태**: 미실행 (재실행 전)
   - **정상 요청 (서버 함수 `/api/notes` 단일 접점 경유)**:
     - **현재 상태**: 미실행 (학생/심판 토큰 확인 필요)

5. **6단계: 등록 기기 검문 판정 점검**
   - **로컬 연습 명령**:
     ```bash
     npm run decider:test
     ```
     - **기대 결과**: 등록 기기 정상 요청은 `allow`, 미등록 기기 요청은 `deny` (`device_not_registered`). *(가상 요청 연습이며 실제 심판 판정이 아님)*
   - **실제 원격 기기 점검**: 미실행

6. **7단계: 복합 이상 접속 추가 확인(`step_up`) 판정 점검**
   - **로컬 연습 명령**:
     ```bash
     npm run fixture:7
     ```
     - **기대 결과**: 정상 사건은 `allow`, 심야·낯선 네트워크·대량 조회 복합 이상 사건은 `step_up` (`step_up_required`), 추가 확인 완료 요청은 `allow`. *(가상 요청 연습이며 실제 심판 판정이 아님)*
   - **실제 원격 재확인 점검**: 미실행

7. **8단계: 구역 분리 및 권한 상승 차단 점검**
   - **로컬 연습 명령**:
     ```bash
     npm run decider:test
     ```
     - **기대 결과**: 메모 구역 정상 요청은 `allow`, 강사 공지 구역 쓰기(`notice_modification_forbidden`) 및 알 수 없는 경로(`unknown_route`)는 `deny`.
   - **실제 원격 구역 분리 점검**: 미실행

8. **9단계: 가상 사건 탐지 및 권한 회수 제안 점검**
   - **로컬 연습 명령**:
     ```bash
     npm run detect:test
     ```
     - **기대 결과**: 10분 내 120건 이하 조회 또는 분산 조회는 `observe`, 10분 내 120건 초과 + 낯선 네트워크 복합 폭주는 해당 가상 기기 1개에 대해 `propose_revocation` (`burst_read`). *(가상 사건 연습이며 운영 반 엔진 연결 결과가 아님)*
   - **실제 원격 탐지·회수 점검**: 미실행

9. **10단계: 안전 정책 비교 및 단건 메모 복원 점검**
   - **로컬 복원 검증 명령**:
     ```bash
     npm run restore:test
     ```
     - **기대 결과**: 사본 재검증 및 diff 사전 확인 통과, 시험 계정 B의 메모 단건 복원 일치 통과, 본문/해시 변조(`HASH_MISMATCH`) 및 타인 소유 복원(`NOT_OWNER`) 차단 통과.
   - **원격 복원 경로(`POST /api/notes/restore`) 점검**: 미실행

## 11단계: 나만의 접속 앱을 완성합니다 (설치형 웹앱 설정 및 기기 승인 상태 연동)

### 현재 작동하는 기능
- **설치형 웹앱 매니페스트 및 안내 (`public/manifest.json`, `public/icon.svg`)**:
  - PWA 표준 `manifest.json` 설정(앱 이름: `최부장의 비공개 가상 자료실`, 테마 색상, 독립 실행 모드 `standalone`)과 앱 아이콘을 추가했습니다.
  - 네트워크 연결이 끊긴 경우를 대비한 오프라인 안내 문구("오프라인 상태에서는 보안을 위해 가상 자료실을 열 수 없습니다.")를 명시했습니다.
  - 설치 표시나 버튼 조작만으로 기기 확인이 끝난 것으로 간주하지 않으며, 별도의 접속 프로그램을 로컬에 강제 설치하지 않습니다.
- **기기 승인 상태 표시 및 서버 승인 제어 (`public/index.html`, `api/notes.js`)**:
  - 화면 상단에 16자리 소문자 16진수 기기 식별자(`deviceId`)와 기기 승인 상태 배지를 표시합니다.
  - 기기 개인키나 민감 인증 정보를 브라우저 로컬 저장소(`localStorage`/`sessionStorage`)에 저장하지 않습니다.
  - 단순 버튼 클릭으로 권한을 획득하지 못하며, 서버(`api/notes.js`)가 해당 기기를 등록 기기로 확인·승인하기 전에는 보호 자료실을 화면에 노출하지 않고 API 호출 시 `403 FORBIDDEN (DEVICE_NOT_REGISTERED)`으로 거부합니다.
  - 서버 승인이 완료된 기기에 대해서만 가상 자료실이 열리고 기존 정상 CRUD 조회가 유지됩니다.
- **기존 보호 요청 및 판정 규칙 유지**:
  - 토큰 인증(Bearer), Supabase DB RLS, 단일 접점(BFF), 판정기 계약 준수(`src/decider.mjs`), 복합 이상 접속 추가 확인(`step_up`), 구역 분리(`zone_isolation`, `zone_rules`), 가상 사건 탐지(`src/detect.mjs`), 안전 사본 해시 대조 단건 복원(`src/restore.mjs`) 등 기존 보호 및 거부 체계가 새 화면에서도 온전히 유지됩니다.

### 다시 실행하는 방법
1. **로컬 빌드 검증**:
   ```bash
   npm run build -- --local
   ```
2. **판정기 계약 및 단위 검증**:
   ```bash
   npm run decider:test
   ```
   - **정상 결과**: 등록 기기의 정상 요청 통과, 미등록 기기 차단 통과.
3. **가상 사건 탐지 및 복원 검증**:
   ```bash
   npm run detect:test
   npm run restore:test
   ```
4. **제출 묶음 생성 및 학생 자체 점검**:
   ```bash
   npm run bundle
   ```

## 12단계: 탈환 작전실을 완성합니다 (통합 설치·실행·중지·복구 가이드)

### 기준 커밋 및 운영 환경
- **검사한 기준 커밋**: `63c05ce fix: 경량화 적용`
- **배포 주소**: `https://choi-bujang-secret-vault-jinyeong.vercel.app`
- **원본 API (Supabase REST)**: `https://rumiyxkamhgodrrdvvft.supabase.co/rest/v1/notes`
- **심판 접수 서버**: `https://aleph-judge-production.up.railway.app/defense/judge`

### 학생 몫과 제공 엔진의 출처 구분

| 구분 | 구성 요소 | 출처 및 역할 | 주요 책임 및 구현 내용 |
| :--- | :--- | :--- | :--- |
| **제공 엔진** | **ALEPH SDP 엔진** (운영 반 / 심판 서버) | **운영 측 제공 엔진** | • 판정기 호출 규격(`docs/DECIDER_REQUEST.md`) 정의<br>• 가상 사건 로그 규격(`docs/DETECT_EVENTS.md`) 전달<br>• 원격 41종 침투 및 방어 평가 집행 (기기 미등록 침투, 폭주 조회 차단, 원격 복구 평가 등) |
| **학생 몫** | **학생 판정기** (`src/decider.mjs`) | **학생 구현** | • 4대 규칙 구현 (`RULE_IDS: ['device_registered', 'step_up_required', 'zone_isolation', 'zone_rules']`)<br>• 엔진 계약 준수: `request.deviceRegistered`, `request.stepUp`, `request.signals`만 사용<br>• 계약된 5개 필수 항목 응답 반환 |
| **학생 몫** | **탐지 규칙** (`src/detect.mjs`) | **학생 구현** | • 가상 사건 로그 입력 정제 (메모 본문·비밀값 배제)<br>• 10분 구간 내 120건 초과 + 낯선 네트워크 복합 의심 탐지<br>• 가상 기기 1건 회수 제안(`propose_revocation`, `burst_read`) |
| **학생 몫** | **비공개 복원 모듈** (`src/restore.mjs`) | **학생 구현** | • 안전 사본 비교(`diffPolicies`) 및 변경 범위 사전 표시(`dryRun`)<br>• 안전 버전(`v1.0-safe-backup`) 무손실 정책 복원(`restorePolicy`)<br>• ID·소유자·내용 해시(SHA-256) 삼중 일치 단건 복원 및 변조 차단 |
| **학생 몫** | **나만의 접속 앱 & 탈환 작전실** (`public/index.html`) | **학생 구현** | • 설치형 웹앱 PWA 규격(`manifest.json`, `icon.svg`) 및 오프라인 안내<br>• 화면 기기 승인 상태 연동 및 미승인 시 보호 자료실 차단<br>• 4대 요약 카드, 1~11단계 정상·금지 요청 실측 대조표 및 실시간 재검증 절차<br>• 가린 서버 감사 기록 (메모 본문 비공개 마스킹) |
| **학생 몫** | **자료실 서버 함수** (`api/notes.js`) | **학생 구현** | • 단일 접점(BFF) 구조로 원본 DB 직접 접근 차단<br>• JWT Bearer 토큰 검증 및 `owner_id` 객체 수준 소유자 인가<br>• 서버 등록 기기 승인 검증 및 단건 안전 복원 경로(`/api/notes/restore`) 제공 |

### 설치·실행·중지·복구 재현 순서

#### 1. 설치 (Prerequisites & Installation)
1. **런타임 환경**: Node.js >= 22 준비
2. **의존성 설치**:
   ```bash
   npm install
   ```
3. **비밀값 관리 안내 (비밀값 포장 금지)**:
   - 데이터베이스 접속 키(`SUPABASE_SECRET_KEY`)나 비밀번호, 토큰 등 실제 비밀값을 코드, 저장소, 문서에 직접 적지 않습니다.
   - Vercel 프로젝트 대시보드의 **Settings** -> **Environment Variables** 화면에 접속하여 공식 비밀 입력란에 `SUPABASE_URL` 및 `SUPABASE_SECRET_KEY`(`service_role` 키)를 직접 입력합니다.

#### 2. 실행 (Execution & Verification)
1. **로컬 빌드 검증**:
   ```bash
   npm run build -- --local
   ```
   - 정상 결과: `public/data.json` 제거 확인 및 로컬 번들 준비 완료.
2. **학생 판정기 계약 단위 검증 (가상 요청 연습)**:
   ```bash
   npm run decider:test
   ```
   - 정상 요청 (등록 기기): `allow` 통과
   - 금지 요청 (미등록 기기): `deny` (`device_not_registered`) 차단
   - 복합 이상 접속: `step_up` (`step_up_required`) 추가 확인 요구
   - *(주의: 이 명령은 가상 요청 기반 로컬 연습이며 실제 심판 판정 증거가 아닙니다.)*
3. **가상 사건 탐지 및 회수 제안 검증**:
   ```bash
   npm run detect:test
   ```
   - 정상/분산 조회: `observe`
   - 10분 내 120건 초과 + 낯선 네트워크 복합 조회: `propose_revocation` (`burst_read`)
   - *(주의: 가상 사건 연습이며 실제 운영 반 엔진 연결이나 심판 통과 증거가 아닙니다.)*
4. **복합 이상 접속 사건 규칙 시험**:
   ```bash
   npm run fixture:7
   ```
   - 정상 사건: `allow`, 복합 이상 사건: `step_up`
5. **안전 정책 사본 비교 및 단건 복원 검증**:
   ```bash
   npm run restore:test
   ```
   - 사본 diff 사전 확인(`dryRun`) 통과
   - ID·소유자·해시 삼중 일치 메모 단건 복원 통과
   - 타인 메모 변조 및 해시 불일치 복원 요청 차단 통과
6. **접속 앱 및 탈환 작전실 화면 실행**:
   - 브라우저에서 `https://choi-bujang-secret-vault-jinyeong.vercel.app` 접속
   - **탈환 작전실 상황판**에서 **[1~11단계 실측 검증 실행]** 버튼 클릭
   - 실측 결과 확인:
     - 금지 요청 거부: `/data.json` 404 차단, 비로그인 `/api/notes` 401 차단, 변조 해시 복원 400 차단
     - 정상 요청 허용: 복원 사전 점검 204 허용, 기기 승인 연동 허용
     - 미실행 41종 시험: `미실행 (심판 41종 점검 대기)` 상태 보존
   - 미승인 기기 안내 확인 -> 로그인 -> **[기기 승인 요청]** 클릭 후 승인 완료 시 보호 자료실 메모 열람

#### 3. 중지 (Stop & Teardown)
1. **접속 앱 세션 및 기기 권한 중지**:
   - 웹 화면 상단의 **[로그아웃]** 버튼을 클릭합니다.
   - 브라우저 메모리의 세션 토큰이 파기되고 기기 승인 상태가 초기화되어 보호 자료실(`vault-protected-area`)이 즉시 잠금 상태(`display: none`)로 전환됩니다.
2. **로컬 검증 프로세스 중지**:
   - 실행 중인 로컬 터미널에서 `Ctrl + C`를 눌러 프로세스를 종료합니다.
3. **비인가 세션 강제 만료 (운영 시)**:
   - 침해 의심 계정 발생 시 Supabase 대시보드(Authentication -> Users)에서 해당 사용자의 세션을 강제 만료(Sign out)합니다.

#### 4. 복구 (Disaster Recovery & Rollback)
1. **정책 침해/변조 복구**:
   - 검증 스크립트 실행:
     ```bash
     npm run restore:test
     ```
   - `diffPolicies`를 통해 침해된 정책과 안전 사본의 차이를 사전 비교하고, `restorePolicy`를 호출하여 안전 기준 버전(`v1.0-safe-backup`)으로 즉시 원복합니다.
2. **가상 메모 단건 복구**:
   - 메모 본문 손상이나 변조 발생 시 `POST /api/notes/restore` 엔드포인트를 호출합니다.
   - 복구 대상 단건의 `id`, `owner_id`, SHA-256 `contentHash`가 사본과 삼중 일치할 때만 복원(upsert)되며, 변조된 본문/해시 요청은 `400 Bad Request`로 거부됩니다.
3. **복구 후 정상/금지 요청 재검증**:
   - 탈환 작전실 상황판의 **[1~11단계 실측 검증 실행]**을 눌러 정상 요청 허용과 금지 요청 거부가 이전과 동일하게 유지되는지 실시간 확인합니다.

## 보너스 트랙: XDR 경보 탐지 및 판정

### 보너스 xdr-01 (brute-force)
- **현재 작동하는 기능**:
  - `xdr/brute-force/decide.mjs`: 단시간 집중 로그인 실패 및 계정 간 비밀번호 스프레잉(Password Spraying) 패턴을 분석하여 `block`, `alert`, `record` 판정과 신뢰도를 반환합니다.
  - 실행기(`scripts/xdr-run.mjs`)를 통해 `xdr/fixtures/brute-force.json` 경보를 판정하고 `xdr/brute-force/result.json`을 생성합니다.

### 보너스 xdr-02 (web-injection)
- **현재 작동하는 기능**:
  - `xdr/web-injection/decide.mjs`: 웹 요청에 포함된 SQL Injection, XSS, Path Traversal 등 웹 주입 공격 형태를 식별하여 `block`, `alert`, `record` 판정과 신뢰도를 반환합니다.
  - 실행기를 통해 `xdr/fixtures/web-injection.json` 경보를 판정하고 `xdr/web-injection/result.json`을 생성합니다.

### 다시 실행하는 방법
```bash
npm run xdr:run -- brute-force
npm run xdr:run -- web-injection
node --test test/xdr-run.test.mjs
```



