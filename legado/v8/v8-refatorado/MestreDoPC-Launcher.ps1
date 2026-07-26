<#
.SYNOPSIS
    Mestre do PC V8 — Launcher Principal Refatorado
.DESCRIPTION
    Inicializa o servidor HTTP seguro com módulos PowerShell, logging estruturado,
    validação de comandos, rate limiting e suporte a RunspacePool.
.NOTES
    Versão: 8.0.0
    Requer PowerShell 7.4+
#>

[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$Uninstall,
    [int]$Port = 18791,
    [string]$ConfigPath = "$PSScriptRoot\src\config\config.json"
)

$ErrorActionPreference = "Stop"

# ============ ADMIN CHECK ============
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[AVISO] Nao esta rodando como Administrador. Algumas funcoes estarao limitadas." -ForegroundColor Yellow
    Write-Host "Recomendado: Feche e execute como Administrador." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}

# ============ PATHS ============
$projectPath = $PSScriptRoot
$configPath = Join-Path $projectPath "src\config\config.json"
$logDir = Join-Path $projectPath "logs"

# ============ IMPORT MODULES ============
$loggerPath = "$projectPath\src\launcher\Logger.psm1"
Write-Host "DEBUG: projectPath=$projectPath"
Write-Host "DEBUG: loggerPath=$loggerPath"
Write-Host "DEBUG: Test-Path result: $(Test-Path $loggerPath)"
try {
    Import-Module $loggerPath -Force -Verbose -ErrorAction Stop
    Write-Host "DEBUG: Logger import succeeded"
} catch {
    Write-Host "DEBUG: Logger import FAILED: $_"
}

$httpPath = "$projectPath\src\launcher\HttpServer.psm1"
try {
    Import-Module $httpPath -Force -Verbose -ErrorAction Stop
    Write-Host "DEBUG: HttpServer import succeeded"
} catch {
    Write-Host "DEBUG: HttpServer import FAILED: $_"
}

Write-Host "DEBUG: Start-MpcServer exists? $(if (Get-Command Start-MpcServer -ErrorAction SilentlyContinue) { 'YES' } else { 'NO' })"

# ============ INSTALL MODE ============
if ($Install) {
    Write-Host "`n[INSTALACAO Mestre do PC V8]" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan

    # Criar diretorios
    @("logs", "temp", "backups") | ForEach-Object {
        $dir = Join-Path $projectPath $_
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "[OK] Diretorio criado: $dir"
        }
    }

    # Instalar Node.js deps (MCP Server)
    $mcpPath = Join-Path $projectPath "mcp-server"
    if (Test-Path (Join-Path $mcpPath "package.json")) {
        Write-Host "`n[Instalando dependencias Node.js para MCP Server]..."
        Push-Location $mcpPath
        try {
            npm install
            Write-Host "[OK] Dependencias Node.js instaladas"
        } catch {
            Write-Host "[ERRO] Falha ao instalar dependencias Node.js: $_" -ForegroundColor Red
        } finally {
            Pop-Location
        }
    }

    # Firewall
    $ruleName = "MestreDoPC-V8"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow | Out-Null
        Write-Host "[OK] Regra de firewall criada: porta $Port"
    } else {
        Write-Host "[INFO] Regra de firewall ja existe"
    }

    # Atalhos
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $startMenuPath = [Environment]::GetFolderPath("StartMenu")
    $wshShell = New-Object -ComObject WScript.Shell

    # Desktop
    $shortcut = $wshShell.CreateShortcut("$desktopPath\Mestre do PC V8.lnk")
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-ExecutionPolicy RemoteSigned -File `"$projectPath\MestreDoPC-Launcher.ps1`""
    $shortcut.WorkingDirectory = $projectPath
    $shortcut.IconLocation = "%SystemRoot%\System32\Shell32.dll,14"
    $shortcut.Save()
    Write-Host "[OK] Atalho criado na Area de Trabalho"

    # Start Menu
    $startDir = Join-Path $startMenuPath "Programs\Mestre do PC V8"
    if (-not (Test-Path $startDir)) { New-Item -ItemType Directory -Path $startDir -Force | Out-Null }
    $shortcut2 = $wshShell.CreateShortcut("$startDir\Mestre do PC V8.lnk")
    $shortcut2.TargetPath = "powershell.exe"
    $shortcut2.Arguments = "-ExecutionPolicy RemoteSigned -File `"$projectPath\MestreDoPC-Launcher.ps1`""
    $shortcut2.WorkingDirectory = $projectPath
    $shortcut2.IconLocation = "%SystemRoot%\System32\Shell32.dll,14"
    $shortcut2.Save()
    Write-Host "[OK] Atalho criado no Menu Iniciar"

    # MCP Config (atualizar caminho)
    $claudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
    if (Test-Path $claudeConfigPath) {
        $claudeConfig = Get-Content $claudeConfigPath | ConvertFrom-Json -AsHashtable
        if ($claudeConfig.mcpServers) {
            $claudeConfig.mcpServers["mestre_do_pc"] = @{
                command = "node"
                args = @("$mcpPath\index.js")
                env = @{
                    MPC_PROJECT_PATH = $projectPath
                }
            }
            $claudeConfig | ConvertTo-Json -Depth 5 | Set-Content $claudeConfigPath -Encoding UTF8
            Write-Host "[OK] Configuracao MCP atualizada no Claude Desktop"
        }
    }

    Write-Host "`n[INSTALACAO CONCLUIDA]" -ForegroundColor Green
    Write-Host "Execute: .\MestreDoPC-Launcher.ps1" -ForegroundColor Green
    return
}

# ============ UNINSTALL MODE ============
if ($Uninstall) {
    Write-Host "`n[DESINSTALACAO Mestre do PC V8]" -ForegroundColor Cyan

    # Parar processos
    Get-Process -Name "powershell" | Where-Object { $_.CommandLine -like "*MestreDoPC*" } | Stop-Process -Force -ErrorAction SilentlyContinue

    # Remover firewall
    Remove-NetFirewallRule -DisplayName "MestreDoPC-V8" -ErrorAction SilentlyContinue

    # Remover atalhos
    Remove-Item "$env:USERPROFILE\Desktop\Mestre do PC V8.lnk" -ErrorAction SilentlyContinue
    Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Mestre do PC V8" -Recurse -ErrorAction SilentlyContinue

    Write-Host "[OK] Desinstalacao concluida" -ForegroundColor Green
    return
}

# ============ MAIN ============
$hasConsole = [System.Environment]::UserInteractive -and -not ([System.Diagnostics.Process]::GetCurrentProcess().MainWindowHandle -eq 0)
if ($hasConsole) {
    Clear-Host
    Write-Host @"
========================================
   MESTRE DO PC V8
   Sistema de Manutencao Windows
========================================
"@ -ForegroundColor Cyan
}

# Inicializar
Initialize-Logger -LogDirectory $logDir
Write-Log -Level INFO -Message "Iniciando Mestre do PC V8" -Source "Launcher" -Metadata @{ admin = $isAdmin; port = $Port }

# Validar config
if (-not (Test-Path $configPath)) {
    Write-Log -Level ERROR -Message "Arquivo de configuracao nao encontrado: $configPath" -Source "Launcher"
    if ($hasConsole) { Write-Host "[ERRO] Configuracao nao encontrada. Verifique se o arquivo config.json existe em src/config/" -ForegroundColor Red }
    exit 1
}

Write-Log -Level INFO -Message "Config carregada de $configPath" -Source "Launcher"

# Iniciar servidor
if ($hasConsole) {
    Write-Host "`nIniciando servidor na porta $Port..." -ForegroundColor Green
    Write-Host "Aguardando conexoes...`n" -ForegroundColor Gray
} else {
    Write-Log -Level INFO -Message "Iniciando servidor na porta $Port (modo headless)" -Source "Launcher"
}

# Iniciar servidor
Start-MpcServer -ConfigPath $configPath
