@echo off
title Mestre do PC V7
echo Iniciando o instalador via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar-MestreDoPC.ps1"
echo.
echo ===================================================
echo Processo finalizado. Pressione qualquer tecla para sair.
pause > nul
