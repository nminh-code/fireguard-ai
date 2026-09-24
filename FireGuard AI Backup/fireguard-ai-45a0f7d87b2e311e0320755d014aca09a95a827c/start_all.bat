@echo off
chcp 65001 > nul
title FireGuard AI - Automated Startup Script

echo ===================================================
echo KHOI DONG HE THONG CANH BAO CHAY FIREGUARD AI
echo ===================================================
echo.

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: 1. Khoi dong Video Bridge Server (Port 8787)
echo [1/4] Dang khoi dong Video Bridge Server (Port 8787)...
set VIDEO_BRIDGE_FPS=15
start "FireGuard AI - Video Bridge" /D "%PROJECT_DIR%" cmd /k "npm run bridge"
ping 127.0.0.1 -n 4 > nul

:: 2. Khoi dong Frontend Web UI (Port 3000)
echo [2/4] Dang khoi dong Frontend Web UI (Port 3000)...
start "FireGuard AI - Web Frontend" /D "%PROJECT_DIR%" cmd /k "npm run dev"
ping 127.0.0.1 -n 4 > nul

:: 3. Khoi dong AI Pipeline Server (Port 8790)
echo [3/4] Dang khoi dong AI Pipeline Server (Port 8790)...
start "FireGuard AI - AI Pipeline" /D "%PROJECT_DIR%" cmd /k "npm run ai:frames"
ping 127.0.0.1 -n 6 > nul

:: 4. Kich hoat luong quet Camera AI
echo [4/4] Dang kich hoat luong quet Camera AI (Control Start)...
call npm run ai:frames:start
echo.

echo.
echo ===================================================
echo DA KHOI DONG TAT CA DICH VU THANH CONG!
echo Giao dien Web: http://localhost:3000
echo Video Bridge:  http://localhost:8787
echo AI Pipeline:   http://localhost:8790
echo ===================================================
echo.
pause
