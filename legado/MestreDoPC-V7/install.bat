

@echo off
echo ===================================================
echo   Installing MestreDoPC V7 MCP Server Dependencies
echo ===================================================
echo.
cd /d "%~dp0"

echo [1/3] Installing npm dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Failed to install npm dependencies.
    pause
    exit /b %ERRORLEVEL%
)

echo [2/3] Building the project...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Compilation failed.
    pause
    exit /b %ERRORLEVEL%
)

echo [3/3] Running tests...
call npm test
if %ERRORLEVEL% neq 0 (
    echo.
    echo WARNING: One or more unit tests failed, but compilation succeeded.
)

echo.
echo ===================================================
echo   MestreDoPC V7 Installed successfully!
echo   You can now use the server.
echo ===================================================
echo.
pause
