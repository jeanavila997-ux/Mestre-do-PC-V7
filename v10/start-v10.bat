@echo off
setlocal
title Mestre do PC V10 - Bootstrap

set "TASK_NAME=MestreDoPC_Admin_Launcher"
set "BASE_DIR=%~dp0"
set "ROOT_DIR=%BASE_DIR%.."
set "HTML_PATH=%BASE_DIR%index.html"
set "REGISTER_SCRIPT=%ROOT_DIR%Register-MestreTask.ps1"

if not exist "%HTML_PATH%" (
    echo [ERRO] HTML da V10 nao encontrado em "%HTML_PATH%".
    exit /b 1
)

:: Re-eleva como Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Reiniciando como Administrador...
    powershell.exe -NoLogo -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ==================================================
echo  MESTRE DO PC V10 -- Bootstrap Admin
echo ==================================================
echo.

schtasks /Query /TN "%TASK_NAME%" >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%REGISTER_SCRIPT%" (
        echo [INFO] Tarefa automatica ausente. Recriando...
        powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%REGISTER_SCRIPT%" -InstallDir "%ROOT_DIR%" -Quiet
    ) else (
        echo [WARN] Register-MestreTask.ps1 nao encontrado — launcher pode nao subir sozinho.
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
echo [OK] Launcher saudavel. Abrindo interface V10...
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