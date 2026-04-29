param(
    [switch]$SkipBuild,
    [switch]$Silent
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDataDir = Join-Path $PSScriptRoot "Mestre_Dados"
$sourceMcpDir = Join-Path $PSScriptRoot "mcp-server"
$targetDir = "C:\MestreDoPC_V7"
$targetMcpDir = Join-Path $targetDir "mcp-server"
$buildScript = Join-Path $repoRoot "Administrador\Build-MestreDoPC.ps1"

function Get-HashString {
    param([string]$Path)

    if (Test-Path $Path) {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    }

    return $null
}

function Copy-IfChanged {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Source)) {
        throw "Arquivo de origem ausente: $Source"
    }

    $sourceHash = Get-HashString -Path $Source
    $destHash = Get-HashString -Path $Destination

    if ($sourceHash -eq $destHash) {
        Write-Host "  [OK] Sem alteracao: $(Split-Path -Leaf $Destination)" -ForegroundColor DarkGray
        return
    }

    $destParent = Split-Path -Parent $Destination
    if ($destParent) {
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }

    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    Write-Host "  [SYNC] $(Split-Path -Leaf $Destination)" -ForegroundColor Green
}

function Copy-DirectoryContent {
    param(
        [string]$SourceDir,
        [string]$DestinationDir
    )

    if (-not (Test-Path $SourceDir)) {
        throw "Diretorio de origem ausente: $SourceDir"
    }

    Get-ChildItem -LiteralPath $SourceDir -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($SourceDir.Length).TrimStart('\')
        $destination = Join-Path $DestinationDir $relative
        Copy-IfChanged -Source $_.FullName -Destination $destination
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Mestre do PC V7 - Sincronizacao do Runtime" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipBuild) {
    if (-not (Test-Path $buildScript)) {
        throw "Build script nao encontrado: $buildScript"
    }

    Write-Host "[STEP] Compilando executaveis..." -ForegroundColor Yellow
    & $buildScript
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
New-Item -ItemType Directory -Path $targetMcpDir -Force | Out-Null

$fileMap = @(
    @{ Source = (Join-Path $sourceDataDir "MestreDoPC-Ultimate-v7.html"); Destination = (Join-Path $targetDir "MestreDoPC-Ultimate-v7.html") },
    @{ Source = (Join-Path $sourceDataDir "MestreDoPC-Launcher.ps1"); Destination = (Join-Path $targetDir "MestreDoPC-Launcher.ps1") },
    @{ Source = (Join-Path $sourceDataDir "Register-MestreTask.ps1"); Destination = (Join-Path $targetDir "Register-MestreTask.ps1") },
    @{ Source = (Join-Path $sourceDataDir "Abrir-MestreDoPC.exe"); Destination = (Join-Path $targetDir "Abrir-MestreDoPC.exe") },
    @{ Source = (Join-Path $sourceDataDir "uninstall.exe"); Destination = (Join-Path $targetDir "uninstall.exe") },
    @{ Source = (Join-Path $sourceDataDir "start-mestre.bat"); Destination = (Join-Path $targetDir "start-mestre.bat") },
    @{ Source = (Join-Path $sourceDataDir "favicon.png"); Destination = (Join-Path $targetDir "favicon.png") },
    @{ Source = (Join-Path $sourceDataDir "logo-mestre-v7-transparent.png"); Destination = (Join-Path $targetDir "logo-mestre-v7-transparent.png") },
    @{ Source = (Join-Path $sourceDataDir "icon.ico"); Destination = (Join-Path $targetDir "icon.ico") },
    @{ Source = (Join-Path $PSScriptRoot "start-mestre.bat"); Destination = (Join-Path $targetDir "start-mestre.bat") },
    @{ Source = (Join-Path $PSScriptRoot "sync-mestre.ps1"); Destination = (Join-Path $targetDir "sync-mestre.ps1") }
)

Write-Host "[STEP] Sincronizando runtime principal..." -ForegroundColor Yellow
foreach ($entry in $fileMap) {
    Copy-IfChanged -Source $entry.Source -Destination $entry.Destination
}

Write-Host "[STEP] Sincronizando mcp-server..." -ForegroundColor Yellow
Copy-DirectoryContent -SourceDir $sourceMcpDir -DestinationDir $targetMcpDir

Write-Host "[STEP] Validando hashes principais..." -ForegroundColor Yellow
@(
    "MestreDoPC-Ultimate-v7.html",
    "MestreDoPC-Launcher.ps1",
    "Register-MestreTask.ps1",
    "Abrir-MestreDoPC.exe",
    "uninstall.exe",
    "start-mestre.bat"
) | ForEach-Object {
    $source = Join-Path $sourceDataDir $_
    if ($_ -eq "start-mestre.bat") {
        $source = Join-Path $PSScriptRoot $_
    }

    $destination = Join-Path $targetDir $_
    $sourceHash = Get-HashString -Path $source
    $destHash = Get-HashString -Path $destination

    if ($sourceHash -ne $destHash) {
        throw "Validacao falhou para $_"
    }

    Write-Host "  [HASH] $_" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[OK] Runtime sincronizado em $targetDir" -ForegroundColor Green
Write-Host ""

if (-not $Silent) {
    Read-Host "Pressione Enter para fechar"
}
