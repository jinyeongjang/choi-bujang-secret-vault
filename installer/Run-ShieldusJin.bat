@echo off
cd /d %~dp0
if "%ON_ENGINE_ADAPTER%"=="" set ON_ENGINE_ADAPTER=student/local-engine-adapter.mjs
start http://127.0.0.1:5189
node src\server.mjs
