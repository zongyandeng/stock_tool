@echo off
title 啟動股票工具 (Stock Tool)
echo 正在啟動股票工具開發伺服器...
cd /d "%~dp0"
call npm run dev -- --open
pause
