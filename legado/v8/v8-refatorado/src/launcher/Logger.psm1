# Mestre do PC V8 — Sistema de Logging Estruturado

function Initialize-Logger {
    param([string]$LogDirectory = "$PSScriptRoot\..\..\logs")
    
    if (-not (Test-Path $LogDirectory)) {
        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
    }
    
    $script:LogDir = $LogDirectory
    $script:LogFile = Join-Path $LogDirectory "launcher-$(Get-Date -Format 'yyyyMM').log"
    
    Get-ChildItem $LogDirectory -Filter "launcher-*.log" | Where-Object {
        $_.LastWriteTime -lt (Get-Date).AddDays(-30)
    } | Remove-Item -Force -ErrorAction SilentlyContinue
}

function Write-Log {
    param(
        [Parameter(Mandatory)]
        [ValidateSet('INFO','WARN','ERROR','AUDIT','DEBUG')]
        [string]$Level,
        
        [Parameter(Mandatory)]
        [string]$Message,
        
        [string]$Source = 'Launcher',
        [hashtable]$Metadata = @{}
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $logEntry = [ordered]@{
        timestamp = $timestamp
        level = $Level
        source = $Source
        message = $Message
        pid = $PID
        metadata = $Metadata
    } | ConvertTo-Json -Compress
    
    $colorMap = @{
        'INFO' = 'White'
        'WARN' = 'Yellow'
        'ERROR' = 'Red'
        'AUDIT' = 'Cyan'
        'DEBUG' = 'Gray'
    }
    
    $consoleMsg = "[$timestamp] [$Level] $Message"
    if ($Metadata.Count -gt 0) {
        $metaStr = ($Metadata.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '
        $consoleMsg += " | $metaStr"
    }
    
    Write-Host $consoleMsg -ForegroundColor $colorMap[$Level]
    
    if ($script:LogFile) {
        $logEntry | Add-Content -Path $script:LogFile -Encoding UTF8
    }
}

Export-ModuleMember -Function Initialize-Logger, Write-Log
