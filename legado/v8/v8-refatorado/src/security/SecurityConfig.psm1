# Mestre do PC V8 — Configuração de Segurança
# Lista de comandos PowerShell permitidos (allowlist)

function Get-AllowedCommands {
    return @(
        # Sistema e informações
        'Get-Process'
        'Get-CimInstance'
        'Get-ComputerInfo'
        'Get-EventLog'
        'Get-PSDrive'
        'Test-Connection'
        
        # Manipulação de processos
        'Stop-Process'
        'Start-Process'
        'Get-Service'
        'Set-Service'
        'Stop-Service'
        'Start-Service'
        'Restart-Service'
        
        # Limpeza
        'Remove-Item'
        'Clear-RecycleBin'
        'Clear-EventLog'
        
        # Rede
        'ipconfig'
        'Get-NetAdapter'
        'Get-NetIPConfiguration'
        
        # Reparo
        'sfc'
        'DISM'
        
        # Segurança
        'Get-MpComputerStatus'
        'Start-MpScan'
        'Get-NetFirewallRule'
        
        # Memória
        '[System.GC]::Collect'
        '[System.GC]::WaitForPendingFinalizers'
        
        # Utilitários
        'ie4uinit.exe'
        'defrag'
        'Optimize-Volume'
        
        # Git
        'git'
        'Set-Location'
    )
}

function Get-DangerousPatterns {
    return @(
        ';\s*Remove-Item.*-Recurse.*-Force'
        'Invoke-Expression'
        'IEX'
        'Invoke-WebRequest.*-OutFile'
        'Start-BitsTransfer'
        'New-Object.*Net.WebClient'
        'DownloadString'
        'DownloadFile'
        'FromBase64String'
        'EncodedCommand'
        '-EncodedCommand'
        'Bypass'
        '-NoProfile.*-WindowStyle Hidden'
        'net user'
        'net localgroup'
        'reg delete'
        'format '
        'del /[fq]'
        'rd /[sq]'
    )
}

$script:SecurityConfig = $null
$script:AllowedCommandSet = $null
$script:DangerousPatternSet = $null

function Initialize-SecurityConfig {
    param([object]$Config)
    
    $script:SecurityConfig = $Config
    $script:AllowedCommandSet = Get-AllowedCommands | ForEach-Object { $_.ToLower() } | Sort-Object -Unique
    $script:DangerousPatternSet = Get-DangerousPatterns | ForEach-Object { [regex]::new($_, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) }
}

function Test-SafeCommand {
    param([string]$Command)
    
    if ([string]::IsNullOrWhiteSpace($Command)) {
        return @{ IsSafe = $false; Reason = "Comando vazio"; Category = "input"; Score = 0 }
    }
    
    # 1. Verificar padrões perigosos
    foreach ($pattern in $script:DangerousPatternSet) {
        if ($pattern.IsMatch($Command)) {
            return @{ IsSafe = $false; Reason = "Padrao perigoso detectado: $($pattern.ToString())"; Category = "dangerous_pattern"; Score = 0 }
        }
    }
    
    # 2. Extrair o comando base (primeira palavra antes de espaços, |, ;, &, etc.)
    $cleanCmd = $Command.Trim() -replace '^\s*\[.*?\]::', ''  # remove [Type]:: prefix
    $baseCmd = ($cleanCmd -split '[\s|;|&\(\)\{\}]')[0].Trim().ToLower()
    
    if ([string]::IsNullOrEmpty($baseCmd)) {
        return @{ IsSafe = $false; Reason = "Nao foi possivel extrair comando base"; Category = "parse_error"; Score = 0 }
    }
    
    # 3. Verificar allowlist
    $isAllowed = $false
    foreach ($allowed in $script:AllowedCommandSet) {
        # Suporta match exato ou prefixo (ex: "git" permite "git status", "git pull")
        if ($baseCmd -eq $allowed -or $Command.Trim().ToLower().StartsWith($allowed + ' ')) {
            $isAllowed = $true
            break
        }
    }
    
    if (-not $isAllowed) {
        return @{ IsSafe = $false; Reason = "Comando nao permitido: '$baseCmd'"; Category = "not_allowed"; Score = 0 }
    }
    
    # 4. Verificações adicionais de profundidade
    if ($Command.Length -gt 4000) {
        return @{ IsSafe = $false; Reason = "Comando excede 4000 caracteres"; Category = "length"; Score = 0 }
    }
    
    # Score de confiança (0-100)
    $score = 100
    if ($Command -match '\$\(.*\)') { $score -= 20 }  # subexpressão
    if ($Command -match '\`') { $score -= 15 }         # backtick
    if ($Command -match '\|') { $score -= 10 }          # pipeline
    
    return @{ IsSafe = $true; Reason = "OK"; Category = "allowed"; Score = [math]::Max(0, $score) }
}

Export-ModuleMember -Function Get-AllowedCommands, Get-DangerousPatterns, Initialize-SecurityConfig, Test-SafeCommand
