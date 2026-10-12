@echo off
chcp 65001 > nul
title FireGuard AI - System Status Check

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\check_services.ps1"

echo.
pause
