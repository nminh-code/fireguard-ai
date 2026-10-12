@echo off
chcp 65001 > nul
title FireGuard AI - Stop All Services

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\stop_services.ps1"

echo.
pause
