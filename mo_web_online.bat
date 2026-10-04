@echo off
title MCPE Mod Translator - Mo Web Online Ra Internet
chcp 65001 >nul
cls

echo =======================================================================
echo          MCPE MOD TRANSLATOR - MO WEB ONLINE RA INTERNET
echo =======================================================================
echo.
echo [*] Dang kiem tra may chu Node.js...

if not exist node_modules\bcryptjs (
    echo [*] Dang cai dat cac thu vien Node.js can thiet...
    call npm.cmd install
    if errorlevel 1 (
        echo [!] Khong the cai thu vien. Vui long kiem tra Internet.
        pause
        exit /b 1
    )
)

echo.
echo [*] Buoc 1: Dang khoi dong Web Server MCPE tai http://localhost:8080...
start "MCPE Web Server (Local:8080)" cmd /k "node server.js"

:: Cho 2 giay de Server on dinh
timeout /t 2 /nobreak >nul

echo.
echo [*] Buoc 2: Dang khoi tao duong link Web Public HTTPS qua Cloudflare...
echo.
echo =======================================================================
echo   DUONG LINK WEB CUA BAN SE HIEN THI BEN DUOI TRONG VAI GIAY!
echo   Dang: https://[ten-ngau-nhien].trycloudflare.com
echo.
echo   - Ban co the gui link nay cho ban be hoac mo tren dien thoai / may tinh!
echo   - Khong can mo port modem, khong can tai khoan, toc do cao toan cau.
echo =======================================================================
echo.

if exist cloudflared.exe (
    cloudflared.exe tunnel --url http://localhost:8080
) else (
    echo [!] Khong tim thay cloudflared.exe, chuyen sang LocalTunnel...
    call npx.cmd --yes localtunnel --port 8080
)

pause
