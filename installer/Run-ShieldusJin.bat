@echo off
setlocal
chcp 65001 >nul
title 보안 Agent 쉴더스진

echo ========================================================
echo   보안 Agent 「쉴더스진」 로컬 서비스를 시작합니다...
echo ========================================================

cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
    echo Node.js 22~24 버전을 설치한 후 다시 실행해 주세요. (https://nodejs.org)
    pause
    exit /b 1
)

start "" http://127.0.0.1:5189
node src\server.mjs

endlocal
