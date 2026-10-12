@echo off
chcp 65001 > nul
title FireGuard AI - Automated Startup Script

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\start_services.ps1"

echo.
pause
