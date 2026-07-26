#Requires -Version 5.1
<#
GitHub Copilot CLI como ORQUESTRADOR central.
Modelo: qwen3-coder-next:cloud (via Ollama).

Copilot pode invocar diretamente os outros agentes pelo shell:
   claude, codex, droid, pi, opencode, openclaw
sao todos comandos no PATH e ficam disponiveis dentro da sessao do Copilot.

Uso:
   .\copilot-orchestrator.ps1
#>
param(
    [string]$Model = 'qwen2.5-coder:1.5b-base'
)

# 1) Garante Ollama rodando
if (-not (Get-Process -Name 'ollama' -ErrorAction SilentlyContinue)) {
    Write-Host "Iniciando Ollama..." -ForegroundColor Yellow
    Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden
    Start-Sleep 3
}

# 2) Confirma modelo disponivel
try {
    $tags = (Invoke-RestMethod -Uri 'http://localhost:11434/api/tags').models.name
} catch {
    Write-Host "ERRO: Ollama nao respondeu em localhost:11434" -ForegroundColor Red; return
}

if ($tags -notcontains $Model) {
    Write-Host "ATENCAO: '$Model' nao esta no manifest local." -ForegroundColor Yellow
    Write-Host "Para instalar: ollama pull $Model" -ForegroundColor Yellow
    Write-Host "Modelos disponiveis:" -ForegroundColor Yellow
    $tags | ForEach-Object { Write-Host "  - $_" }
    return
}

# 3) Mostra ferramentas (outros agentes) disponiveis pro Copilot orquestrar
Write-Host ""
Write-Host "=== COPILOT CLI (Orquestrador) ===" -ForegroundColor Cyan
Write-Host "Modelo:  $Model" -ForegroundColor Green
Write-Host "Backend: http://localhost:11434" -ForegroundColor Green
Write-Host ""
Write-Host "Agentes disponiveis pra delegar (via shell):" -ForegroundColor Cyan
$agents = @('codex','copilot','droid','pi','opencode','openclaw')
foreach ($a in $agents) {
    $cmd = Get-Command $a -ErrorAction SilentlyContinue
    if ($cmd) { Write-Host "  [OK]    $a  -> $($cmd.Source)" -ForegroundColor DarkGreen }
    else      { Write-Host "  [FALTA] $a" -ForegroundColor DarkGray }
}
Write-Host ""
Write-Host "Dentro do Copilot, voce pode pedir:" -ForegroundColor Yellow
Write-Host "  'rode codex -p ...'      'use opencode pra X'      'chame droid pra Y'" -ForegroundColor DarkGray
Write-Host "Copilot tem permissao de shell e executa qualquer um deles." -ForegroundColor DarkGray
Write-Host ""

# 4) Configura env vars apontando pro Ollama
$env:COPILOT_PROVIDER_BASE_URL = 'http://localhost:11434/v1'
$env:COPILOT_PROVIDER_API_KEY  = 'ollama'
$env:COPILOT_PROVIDER_WIRE_API = 'responses'
$env:COPILOT_MODEL             = $Model

# 5) Lanca
copilot
