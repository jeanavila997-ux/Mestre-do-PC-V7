#Requires -Version 5.1
<#
Instala Ollama e baixa os modelos usados pelos scripts locais.
Uso: .\install-ollama.ps1
#>

$OllamaInstaller = "$env:TEMP\OllamaSetup.exe"
$OllamaUrl = "https://ollama.com/download/OllamaSetup.exe"

Write-Host "=== Instalador Ollama ===" -ForegroundColor Cyan

# Verifica se ja esta instalado
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host "Ollama ja esta instalado: $(ollama --version)" -ForegroundColor Green
} else {
    Write-Host "Baixando Ollama..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $OllamaUrl -OutFile $OllamaInstaller -UseBasicParsing
    Write-Host "Instalando..." -ForegroundColor Yellow
    $proc = Start-Process -FilePath $OllamaInstaller -ArgumentList "/SILENT" -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Host "ERRO: A instalacao do Ollama falhou com codigo $($proc.ExitCode)" -ForegroundColor Red
        return
    }
    Write-Host "Ollama instalado com sucesso. Reinicie o terminal e rode este script novamente." -ForegroundColor Green
    return
}

# Inicia servico se necessario
if (-not (Get-Process -Name 'ollama' -ErrorAction SilentlyContinue)) {
    Write-Host "Iniciando servico Ollama..." -ForegroundColor Yellow
    Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden
    Start-Sleep 5
}

# Baixa modelos usados pelos scripts
$Models = @('qwen2.5-coder:1.5b-base')

foreach ($m in $Models) {
    $tags = try { (Invoke-RestMethod -Uri 'http://localhost:11434/api/tags').models.name } catch { @() }
    if ($tags -contains $m) {
        Write-Host "[OK] $m ja esta local" -ForegroundColor DarkGreen
    } else {
        Write-Host "Baixando $m ..." -ForegroundColor Yellow
        ollama pull $m
    }
}

Write-Host ""
Write-Host "Modelos disponiveis:" -ForegroundColor Cyan
ollama list
