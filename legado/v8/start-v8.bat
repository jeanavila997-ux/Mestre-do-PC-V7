@echo off
title Mestre do PC V8 - Ativador
cd /d "%~dp0"
echo ========================================
echo    MESTRE DO PC V8 - ATIVANDO...
echo ========================================
echo [1/2] Verificando Ollama...
where ollama >nul 2>nul && (ollama list >nul 2>nul || start "Ollama" ollama serve)
echo [2/2] Iniciando launcher na porta 18791...
node launcher.js
pause