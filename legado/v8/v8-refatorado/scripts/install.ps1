# ================================================================
# Mestre do PC V8 - Instalador
# ================================================================
param(
    [string] $InstallDir = (Split-Path $PSScriptRoot -Parent),
    [switch] $SkipNode,
    [switch] $SkipMcpConfig,
    [switch] $NoShortcuts,
    [switch] $Quiet
)
$ErrorActionPreference = "Stop"
function Write-Step { param([string]$Message,[string]$Color="Cyan")
    if (-not $Quiet) { Write-Host "[INSTALL] $Message" -ForegroundColor $Color } }
function Write-Ok { param([string]$m)
    if (-not $Quiet) { Write-Host "[ OK ] $m" -ForegroundColor Green } }
function Write-Warn2 { param([string]$m)
    if (-not $Quiet) { Write-Host "[WARN] $m" -ForegroundColor Yellow } }
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warn2 "Reiniciando como Administrador..."
    $psExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
    Start-Process $psExe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}
Write-Step "Diretorio de instalacao: $InstallDir"
$required = @(
    "MestreDoPC-Launcher.ps1",
    "src\launcher\HttpServer.psm1",
    "src\launcher\Logger.psm1",
    "src\launcher\JobManager.psm1",
    "src\security\SecurityConfig.psm1",
    "src\config\config.json",
    "mcp-server\package.json",
    "mcp-server\index.js"
)
foreach ($rel in $required) {
    $full = Join-Path $InstallDir $rel
    if (-not (Test-Path $full)) { Write-Error "Arquivo obrigatorio nao encontrado: $full"; exit 1 }
}
Write-Ok "Arquivos essenciais presentes."
if (-not $SkipNode) {
    Write-Step "Verificando Node.js..."
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $ver = & node --version
        Write-Ok "Node detectado: $ver"
    } else {
        Write-Warn2 "Node.js ausente. Instalando via winget..."
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if (-not $winget) {
            Write-Error "winget nao esta disponivel. Instale Node.js LTS manualmente de https://nodejs.org"; exit 1
        }
        & winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) { Write-Error "Falha ao instalar Node.js via winget (codigo $LASTEXITCODE)."; exit 1 }
        $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
        Write-Ok "Node.js instalado."
    }
}
$mcpDir = Join-Path $InstallDir "mcp-server"
Write-Step "Instalando dependencias do mcp-server..."
Push-Location $mcpDir
try {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install falhou (codigo $LASTEXITCODE)" }
    Write-Ok "Dependencias instaladas."
} finally { Pop-Location }
Write-Step "Registrando tarefa do Launcher (AtLogon, Admin)..."
$registerScript = Join-Path $InstallDir "scripts\Register-MestreTask.ps1"
& $registerScript -InstallDir $InstallDir -Quiet
if ($LASTEXITCODE -ne 0) { throw "Falha ao registrar tarefa do launcher." }
Write-Ok "Tarefa 'MestreDoPC_Admin_Launcher' registrada com trigger AtLogon."
if (-not $SkipMcpConfig) {
    Write-Step "Registrando MCP..."
    $claudeCfgDir  = Join-Path $env:APPDATA "Claude"
    $claudeCfgFile = Join-Path $claudeCfgDir "claude_desktop_config.json"
    if (-not (Test-Path $claudeCfgDir)) { New-Item -ItemType Directory -Path $claudeCfgDir -Force | Out-Null }
    function ConvertTo-HashtableDeep {
        param($obj)
        if ($null -eq $obj) { return $null }
        if ($obj -is [System.Collections.IDictionary]) { return $obj }
        if ($obj -is [System.Management.Automation.PSCustomObject]) {
            $h = [ordered]@{}
            foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = ConvertTo-HashtableDeep $p.Value }
            return $h
        }
        if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) {
            return @($obj | ForEach-Object { ConvertTo-HashtableDeep $_ })
        }
        return $obj
    }
    $cfg = [ordered]@{}
    if (Test-Path $claudeCfgFile) {
        try {
            $raw = Get-Content $claudeCfgFile -Raw -ErrorAction Stop
            if ($raw.Trim().Length -gt 0) {
                $parsed = $raw | ConvertFrom-Json -ErrorAction Stop
                $cfg = ConvertTo-HashtableDeep $parsed
                if (-not ($cfg -is [System.Collections.IDictionary])) { $cfg = [ordered]@{} }
            }
        } catch {
            Write-Warn2 "Config atual invalido. Fazendo backup em claude_desktop_config.json.bak"
            Copy-Item $claudeCfgFile "$claudeCfgFile.bak" -Force
            $cfg = [ordered]@{}
        }
    }
    if (-not $cfg.Contains("mcpServers")) { $cfg["mcpServers"] = [ordered]@{} }
    if (-not ($cfg["mcpServers"] -is [System.Collections.IDictionary])) { $cfg["mcpServers"] = [ordered]@{} }
    $indexJs = Join-Path $InstallDir "mcp-server\index.js"
    $cfg["mcpServers"]["mestre_do_pc"] = [ordered]@{
        command = "node"
        args    = @($indexJs)
        env     = [ordered]@{ MESTRE_PROJETO_PATH = $InstallDir }
    }
    ($cfg | ConvertTo-Json -Depth 10) | Set-Content -Path $claudeCfgFile -Encoding UTF8
    Write-Ok "MCP 'mestre_do_pc' registrado em $claudeCfgFile"
}
if (-not $NoShortcuts) {
    Write-Step "Criando atalhos..."
    $startBat = Join-Path $InstallDir "scripts\start-mestre.bat"
    $iconPath = Join-Path $InstallDir "icon.ico"
    $targets = @(
        (Join-Path ([Environment]::GetFolderPath("Desktop")) "Mestre do PC V8.lnk"),
        (Join-Path ([Environment]::GetFolderPath("Programs")) "Mestre do PC V8.lnk")
    )
    $wsh = New-Object -ComObject WScript.Shell
    foreach ($lnk in $targets) {
        $s = $wsh.CreateShortcut($lnk)
        $s.TargetPath       = $startBat
        $s.WorkingDirectory = $InstallDir
        if (Test-Path $iconPath) { $s.IconLocation = $iconPath }
        $s.Description      = "Mestre do PC V8"
        $s.Save()
    }
    Write-Ok "Atalhos criados."
}
Write-Step "Health-check..."
try { Start-ScheduledTask -TaskName "MestreDoPC_Admin_Launcher" -ErrorAction Stop } catch {
    Write-Warn2 "Nao foi possivel disparar a tarefa agendada automaticamente."
}
$ok = $false
for ($i = 0; $i -lt 20; $i++) {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:18791/ping" -TimeoutSec 2 -ErrorAction Stop
        if ($r.status -eq "ok") { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if ($ok) { Write-Ok "Launcher respondendo em http://127.0.0.1:18791" } else {
    Write-Warn2 "Launcher nao respondeu em 20s. Verifique manualmente rodando scripts\start-mestre.bat"
}
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " INSTALACAO CONCLUIDA" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host " * Reinicie o Claude Desktop para carregar o MCP." -ForegroundColor Gray
Write-Host " * Abra 'Mestre do PC V8' pelo atalho do Desktop." -ForegroundColor Gray
Write-Host ""
