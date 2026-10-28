@echo off
cd /d %~dp0
set /p V=Yeni surum numarasi (ornek 1.0.1): 
if "%V%"=="" (echo Numara girilmedi. & pause & exit /b 1)
call npm pkg set version=%V%
git add -A
git commit -m "Surum %V%"
git tag v%V%
git push origin main
git push origin v%V%
echo.
echo Gonderildi. GitHub'da Actions sekmesinde kurulum dosyasi birkac dakika icinde hazirlanir:
echo https://github.com/mrchavoo/vantatracker/actions
pause
