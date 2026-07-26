@echo off
setlocal
title Mestre do PC V10 - Instalador

echo.
echo  ==========================================
echo   MESTRE DO PC V10 -- Instalacao
echo  ==========================================
echo.
echo  Aguarde... UAC sera solicitado uma vez.
echo.

:: Verifica se ja e Admin
net session >nul 2>&1
if %errorlevel% equ 0 goto :runInstall

:: Nao e Admin: eleva e espera terminar
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoLogo -NoProfile -ExecutionPolicy Bypass -File ""%~dp0install.ps1""'"

:openApp
echo.
echo  [OK] Instalacao concluida.
echo  Atalho "Mestre do PC" criado na Area de Trabalho.
echo.
timeout /t 3 /nobreak >nul
exit /b 0

:runInstall
:: Ja e Admin: roda direto
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
goto :openApp