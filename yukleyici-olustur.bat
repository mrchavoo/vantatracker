@echo off
cd /d %~dp0
call npm install
call npm run dist
echo.
echo Kurulum dosyasi dist klasorunde hazir.
pause
