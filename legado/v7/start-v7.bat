@echo off
REM Mestre do PC V7 - Ativador
title Mestre do PC V7 - Launcher
cd /d "%~dp0"
echo ========================================
echo    MESTRE DO PC V7 - ATIVANDO...
echo ========================================
echo.
echo [1/2] Verificando Ollama local...
where ollama >nul 2>nul && (ollama list >nul 2>nul || start "Ollama" ollama serve)
echo [2/2] Iniciando launcher Node na porta 7777...
node launcher.js
pause