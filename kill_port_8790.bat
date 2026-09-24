@echo off
chcp 65001 > nul
title FireGuard AI - Kill Port 8790

echo ===================================================
echo DANG GIAI PHONG CONG 8790 (KILL PORT 8790)
echo ===================================================
echo.

powershell -Command "Get-NetTCPConnection -LocalPort 8790 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [OK] Da giai phong cong 8790 thanh cong!
echo.
timeout /t 3 > nul
