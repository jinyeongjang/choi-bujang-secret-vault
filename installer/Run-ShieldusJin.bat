@echo off  
cd /d %~dp0  
start http://127.0.0.1:5189  
node src\server.mjs 
