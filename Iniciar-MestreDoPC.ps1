# Configura codificação de saída para UTF8 para evitar problemas de acentos no console
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Clear-Host
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "           MESTRE DO PC V7 - INSTALADOR LOCAL      " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Node.js
Write-Host "[1/5] Verificando Node.js..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node -v
    Write-Host "[OK] Node.js detectado: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "" -ForegroundColor Red
    Write-Host "[ERRO] O Node.js não foi encontrado no seu sistema!" -ForegroundColor Red
    Write-Host "Por favor, instale o Node.js (versão 18 ou superior) de: https://nodejs.org/" -ForegroundColor Red
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host ""

# 2. Instalar Dependências
Write-Host "[2/5] Instalando dependências do projeto..." -ForegroundColor Yellow
$subFolder = Join-Path $PSScriptRoot "MestreDoPC-V7"
if (-not (Test-Path $subFolder)) {
    Write-Host "[ERRO] Não foi possível encontrar a pasta 'MestreDoPC-V7' no caminho: $subFolder" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Set-Location $subFolder
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha ao instalar dependências do npm." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host "[OK] Dependências instaladas com sucesso." -ForegroundColor Green
Write-Host ""

# 3. Compilar TypeScript
Write-Host "[3/5] Compilando TypeScript (build)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha ao compilar o TypeScript." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host "[OK] Compilação concluída com sucesso (arquivos em dist/)." -ForegroundColor Green
Write-Host ""

# 4. Criar Atalho na Área de Trabalho
Write-Host "[4/5] Criando atalho na sua Área de Trabalho..." -ForegroundColor Yellow
try {
    $desktop = [System.Environment]::GetFolderPath('Desktop')
    $wshell = New-Object -ComObject WScript.Shell
    $shortcutPath = Join-Path $desktop "Mestre do PC V7.lnk"
    $shortcut = $wshell.CreateShortcut($shortcutPath)
    
    # O atalho aponta para o arquivo instalar.bat que é 100% ASCII
    $shortcut.TargetPath = Join-Path $PSScriptRoot "instalar.bat"
    $shortcut.WorkingDirectory = $PSScriptRoot
    $shortcut.IconLocation = "shell32.dll,239"
    $shortcut.Save()
    Write-Host "[OK] Atalho 'Mestre do PC V7' criado na sua Área de Trabalho!" -ForegroundColor Green
} catch {
    Write-Host "[AVISO] Não foi possível criar o atalho automaticamente: $_" -ForegroundColor Yellow
}
Write-Host ""

# 5. Inicialização do Servidor MCP
Write-Host "[5/5] Tudo pronto! Inicializando o servidor MCP..." -ForegroundColor Yellow
Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "   O Servidor MCP Mestre do PC V7 está ativo!      " -ForegroundColor Green
Write-Host "   Mantenha esta janela aberta para uso no Claude.  " -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""

npm start
