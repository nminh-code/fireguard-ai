@echo off
chcp 65001 > nul
title FireGuard AI - Check AI Status

echo ===================================================
echo KIEM TRA TRANG THAI LUONG CAMERA AI (AI PIPELINE STATUS)
echo ===================================================
echo.

call npm run ai:frames:status
echo.
pause
