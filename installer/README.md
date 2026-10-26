# 보안 Agent 「쉴더스진」 Inno Setup 배포 패키징 안내

이 디렉터리는 보안 Agent 「쉴더스진」을 Windows 환경에서 관리자 권한 없이 간편하게 설치하고 실행할 수 있는 **Inno Setup 설치 프로그램(`ShieldusJin-Setup.exe`)** 빌드 스크립트를 포함합니다.

---

## 1. 포장 규격 및 원칙
- **포장 형태**: 기본 포장 뒤 Inno Setup 설치 프로그램 (`setup.exe`)
- **설치 권한**: 사용자 단위 설치 (`PrivilegesRequired=lowest`)
  - 관리자 권한(UAC 승인 창)이 필요 없으며, 일반 사용자 계정의 `%LocalAppData%\ShieldusJin`에 안전하게 설치됩니다.
- **보안 원칙**: 개인 자격 증명(`.env`)이나 캐시 파일(`node_modules/`, `artifacts/`)은 번들에서 원천 배제됩니다.

---

## 2. 파일 구성
- `ShieldusJin-Setup.iss`: Inno Setup 6 컴파일러용 공식 빌드 스크립트
- `Run-ShieldusJin.bat`: 설치 후 바탕화면 및 시작 메뉴 바로가기에서 서버를 기동하고 브라우저를 자동 실행하는 배치 런처

---

## 3. 빌드(컴파일) 방법

### 방법 A. Inno Setup GUI 도구 사용
1. [Inno Setup 공식 웹사이트](https://jrsoftware.org/isdl.php)에서 Inno Setup 6 최신 버전을 설치합니다.
2. `installer/ShieldusJin-Setup.iss` 파일을 우클릭하고 **[Compile]**을 선택합니다.
3. 빌드가 완료되면 상위 폴더의 `Output/ShieldusJin-Setup.exe` 파일이 생성됩니다.

### 방법 B. 명령 프롬프트(CLI) 사용
Inno Setup 6이 설치된 환경에서 아래 명령을 실행합니다:
```powershell
# Inno Setup CLI 컴파일 명령
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" .\installer\ShieldusJin-Setup.iss
```
컴파일이 완료되면 `Output\ShieldusJin-Setup.exe` 파일이 생성됩니다.

---

## 4. 설치 및 실행 확인
1. 생성된 `ShieldusJin-Setup.exe`를 더블 클릭하여 사용자 단위 설치를 진행합니다.
2. 설치 완료 후 바탕화면의 **「보안 Agent 쉴더스진」** 바로가기를 더블 클릭합니다.
3. 로컬 서버가 자동으로 기동되며 웹 브라우저(`http://127.0.0.1:5189`)가 열리고, 화면 틀 **기록 타임라인형 뷰**와 **내 PC 리소스 상태 실측 기능**을 바로 사용하실 수 있습니다.
