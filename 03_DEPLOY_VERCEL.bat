@echo off
chcp 65001 >nul
npm install
npx vercel --prod
pause
