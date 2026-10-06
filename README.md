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
