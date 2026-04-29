@echo off
setlocal
title Mestre do PC V7 - Bootstrap

set "TASK_NAME=MestreDoPC_Admin_Launcher"
set "BASE_DIR=%~dp0"
set "RUNTIME_DIR=%BASE_DIR%"
if not exist "%RUNTIME_DIR%MestreDoPC-Launcher.ps1" set "RUNTIME_DIR=%BASE_DIR%Mestre_Dados\"
set "INSTALL_DIR=%RUNTIME_DIR:~0,-1%"
set "HTML_PATH=%RUNTIME_DIR%MestreDoPC-Ultimate-v7.html"
set "REGISTER_SCRIPT=%RUNTIME_DIR%Register-MestreTask.ps1"

if not exist "%HTML_PATH%" (
    echo [ERRO] HTML principal nao encontrado em "%HTML_PATH%".
    exit /b 1
)

if not exist "%REGISTER_SCRIPT%" (
    echo [ERRO] Script de registro da tarefa nao encontrado em "%REGISTER_SCRIPT%".
    exit /b 1
)

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Reiniciando como Administrador...
    powershell.exe -NoLogo -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ==================================================
echo  MESTRE DO PC V7 -- Bootstrap Admin
echo ==================================================
echo.

schtasks /Query /TN "%TASK_NAME%" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Tarefa automatica ausente. Recriando...
    powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%REGISTER_SCRIPT%" -InstallDir "%INSTALL_DIR%" -Quiet
    if %errorlevel% neq 0 (
        echo [ERRO] Nao foi possivel registrar a tarefa automatica.
        exit /b 1
    )
)

call :checkHealth
if %errorlevel% equ 0 goto openHtml

echo [INFO] Iniciando launcher admin pela tarefa agendada...
schtasks /Run /TN "%TASK_NAME%" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao disparar a tarefa "%TASK_NAME%".
    exit /b 1
)

call :waitForHealth 20
if %errorlevel% neq 0 (
    echo [ERRO] O launcher nao respondeu na porta 7777 apos 20 segundos.
    exit /b 1
)

:openHtml
echo [OK] Launcher saudavel. Abrindo interface...
start "" "%HTML_PATH%"
exit /b 0

:checkHealth
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:7777/ping' -TimeoutSec 2 -ErrorAction Stop; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }"
exit /b %errorlevel%

:waitForHealth
set "MAX_ATTEMPTS=%~1"
if "%MAX_ATTEMPTS%"=="" set "MAX_ATTEMPTS=15"
set /a CURRENT_ATTEMPT=0
:waitLoop
set /a CURRENT_ATTEMPT+=1
call :checkHealth
if %errorlevel% equ 0 exit /b 0
if %CURRENT_ATTEMPT% geq %MAX_ATTEMPTS% exit /b 1
timeout /t 1 /nobreak >nul
goto waitLoop
