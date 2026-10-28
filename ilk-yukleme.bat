@echo off
cd /d %~dp0
echo VantaTracker dosyalari GitHub'a yukleniyor...
git --version >nul 2>&1 || (echo Git kurulu degil. https://git-scm.com adresinden kur, sonra tekrar calistir. & pause & exit /b 1)
if not exist .git git init
git add -A
git commit -m "Ilk surum"
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin https://github.com/mrchavoo/vantatracker.git
git push -u origin main
echo.
echo Bitti. Hata gorduysen yukaridaki mesaji kopyalayip bana gonder.
pause
