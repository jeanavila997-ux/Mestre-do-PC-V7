@echo off
chcp 65001 >nul
title Mestre do PC V8
cd /d "%~dp0\.."
echo ==========================================
echo  Mestre do PC V8 - Iniciando...          
echo ==========================================
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "MestreDoPC-Launcher.ps1"
echo.
echo Servidor encerrado. Pressione qualquer tecla para sair.
pause >nul
