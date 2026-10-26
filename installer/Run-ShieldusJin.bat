@echo off
cd /d %~dp0
if "%ON_ENGINE_ADAPTER%"=="" set ON_ENGINE_ADAPTER=student/local-engine-adapter.mjs
if "%ON_PROJECT_DIRECTORY%"=="" set ON_PROJECT_DIRECTORY=%~dp0
if "%ON_APPROVED_PUBLIC_PACKAGES%"=="" set ON_APPROVED_PUBLIC_PACKAGES=["@supabase/supabase-js","jose"]
start http://127.0.0.1:5189
node src\server.mjs
