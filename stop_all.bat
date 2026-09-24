@echo off
chcp 65001 > nul
title FireGuard AI - Stop All Services

echo ===================================================
echo DANG DUNG TAT CA DICH VU FIREGUARD AI...
echo ===================================================
echo.

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: 1. Gui lenh ngat ket noi Camera AI
echo 1. Gui lenh ngat ket noi Camera AI...
call npm run ai:frames:stop 2>nul

:: 2. Dong cac cua so dich vu
echo 2. Dong cac cua so dich vu...
taskkill /FI "WINDOWTITLE eq FireGuard AI - Video Bridge*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq FireGuard AI - AI Pipeline*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq FireGuard AI - Web Frontend*" /F >nul 2>&1
taskkill /IM go2rtc.exe /F >nul 2>&1

:: 3. Giai phong cac cong 8790, 8787, 1984
echo 3. Giai phong cac cong 8790, 8787, 1984...
powershell -Command "Get-NetTCPConnection -LocalPort 8790,8787,1984 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo ===================================================
echo DA DUNG HOAN TOAN TAT CA DICH VU!
echo ===================================================
echo.
pause
