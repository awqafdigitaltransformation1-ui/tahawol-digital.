@echo off
chcp 65001 >nul
npm install
if errorlevel 1 pause & exit /b 1
npx cap add android
if errorlevel 1 pause & exit /b 1
npx cap sync android
echo.
echo Android project is ready. Run 02_OPEN_ANDROID_STUDIO.bat
pause
