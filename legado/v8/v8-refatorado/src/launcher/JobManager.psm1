# Mestre do PC V8 — Gerenciador de Jobs com RunspacePool
# Substitui Start-Job por RunspacePool para melhor performance

$script:RunspacePool = $null
$script:CommandJobs = [hashtable]::Synchronized(@{})
$script:JobId = 0

function Initialize-JobManager {
    param([int]$MinRunspaces = 1, [int]$MaxRunspaces = 5)
    
    $script:RunspacePool = [runspacefactory]::CreateRunspacePool($MinRunspaces, $MaxRunspaces)
    $script:RunspacePool.Open()
    
    Write-Log -Level INFO -Message "JobManager inicializado com $MinRunspaces-$MaxRunspaces runspaces" -Source "JobManager"
}

function New-CommandJob {
    param(
        [Parameter(Mandatory)]
        [string]$CommandText,
        
        [int]$TimeoutSeconds = 900
    )
    
    $jobId = [guid]::NewGuid().ToString("N")
    
    $powershell = [powershell]::Create()
    $powershell.RunspacePool = $script:RunspacePool
    
    # Script seguro para execução
    $powershell.AddScript({
        param([string]$IncomingCommand)
        $ErrorActionPreference = "Continue"
        try {
            # Usar Invoke-Command em vez de Invoke-Expression para mais segurança
            $output = Invoke-Command -ScriptBlock ([scriptblock]::Create($IncomingCommand)) *>&1 | Out-String
            [pscustomobject]@{
                success = $true
                output = $output
                exitCode = $LASTEXITCODE
                completedAt = Get-Date -Format "o"
            }
        } catch {
            [pscustomobject]@{
                success = $false
                output = "ERRO: $($_.Exception.Message)"
                exitCode = 1
                completedAt = Get-Date -Format "o"
            }
        }
    }) | Out-Null
    
    $powershell.AddParameter("IncomingCommand", $CommandText) | Out-Null
    
    $handle = $powershell.BeginInvoke()
    
    $entry = [ordered]@{
        Id = $jobId
        State = "running"
        StartedAt = Get-Date
        CompletedAt = $null
        Success = $null
        ExitCode = $null
        Output = ""
        PowerShell = $powershell
        Handle = $handle
        TimeoutSeconds = $TimeoutSeconds
    }
    
    $script:CommandJobs[$jobId] = $entry
    
    Write-Log -Level INFO -Message "Job $jobId iniciado" -Source "JobManager" -Metadata @{ command = $CommandText.Substring(0, [Math]::Min(100, $CommandText.Length)) }
    
    return $entry
}

function Get-CommandJob {
    param([string]$JobId)
    
    $entry = $script:CommandJobs[$JobId]
    if (-not $entry) { return $null }
    
    # Verificar se completou
    if ($entry.State -eq "running" -and $entry.Handle.IsCompleted) {
        try {
            $result = $entry.PowerShell.EndInvoke($entry.Handle)
            $entry.Success = $result.success
            $entry.ExitCode = $result.exitCode
            $entry.Output = $result.output
            $entry.State = if ($result.success) { "completed" } else { "failed" }
            $entry.CompletedAt = Get-Date
            
            # Limpar recursos
            $entry.PowerShell.Dispose()
            $entry.PowerShell = $null
            $entry.Handle = $null
            
            Write-Log -Level INFO -Message "Job $JobId $($entry.State)" -Source "JobManager" -Metadata @{ success = $entry.Success }
        } catch {
            $entry.State = "failed"
            $entry.Success = $false
            $entry.Output = "ERRO: $($_.Exception.Message)"
            $entry.CompletedAt = Get-Date
            
            Write-Log -Level ERROR -Message "Job $JobId falhou: $($_.Exception.Message)" -Source "JobManager"
        }
    }
    
    # Verificar timeout
    if ($entry.State -eq "running") {
        $elapsed = (Get-Date) - $entry.StartedAt
        if ($elapsed.TotalSeconds -ge $entry.TimeoutSeconds) {
            $entry.State = "timed_out"
            $entry.Success = $false
            $entry.ExitCode = -1
            $entry.Output = "ERRO: Timeout apos $($entry.TimeoutSeconds) segundos."
            $entry.CompletedAt = Get-Date
            
            # Tentar parar
            if ($entry.PowerShell) {
                try { $entry.PowerShell.Stop() } catch {}
                $entry.PowerShell.Dispose()
                $entry.PowerShell = $null
            }
            
            Write-Log -Level WARN -Message "Job $JobId timeout" -Source "JobManager"
        }
    }
    
    return $entry
}

function Get-ActiveJobCount {
    $running = $script:CommandJobs.Values | Where-Object { $_.State -eq "running" }
    return ($running | Measure-Object).Count
}

function Remove-StaleJobs {
    param([int]$RetentionMinutes = 30)
    
    $now = Get-Date
    $toRemove = @()
    
    foreach ($key in $script:CommandJobs.Keys) {
        $entry = $script:CommandJobs[$key]
        if ($entry.CompletedAt -and (($now - $entry.CompletedAt).TotalMinutes -ge $RetentionMinutes)) {
            $toRemove += $key
        }
    }
    
    foreach ($key in $toRemove) {
        $script:CommandJobs.Remove($key)
    }
    
    if ($toRemove.Count -gt 0) {
        Write-Log -Level DEBUG -Message "Removidos $($toRemove.Count) jobs antigos" -Source "JobManager"
    }
}

function Stop-JobManager {
    foreach ($key in $script:CommandJobs.Keys) {
        $entry = $script:CommandJobs[$key]
        if ($entry.PowerShell) {
            try { $entry.PowerShell.Stop() } catch {}
            $entry.PowerShell.Dispose()
        }
    }
    
    if ($script:RunspacePool) {
        $script:RunspacePool.Close()
        $script:RunspacePool.Dispose()
    }
    
    Write-Log -Level INFO -Message "JobManager encerrado" -Source "JobManager"
}

Export-ModuleMember -Function Initialize-JobManager, New-CommandJob, Get-CommandJob, 
    Get-ActiveJobCount, Remove-StaleJobs, Stop-JobManager
