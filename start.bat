@echo off
title MCPE Mod Auto-Translator
chcp 65001 >nul
cls

rem === Dien tai khoan admin DUY NHAT cua web (mat khau toi thieu 8 ky tu) ===
set "ADMIN_EMAIL=quocbao2208209@gmail.com"
set "ADMIN_PASSWORD=Buibao2009"

echo ========================================================
echo       MCPE MOD AUTO-TRANSLATOR (Minecraft Bedrock)
echo ========================================================
echo.

if not exist node_modules\bcryptjs (
    echo [*] Dang cai cac thu vien Node.js can thiet...
    call npm install
    if errorlevel 1 (
        echo [!] npm install that bai. Hay kiem tra Node.js va Internet.
        pause
        exit /b 1
    )
)

echo [*] Dang khoi dong may chu Web...
echo [*] Trinh duyet se tu dong mo tai http://localhost:2208
echo.

start "" http://localhost:2208
node server.js

pause
