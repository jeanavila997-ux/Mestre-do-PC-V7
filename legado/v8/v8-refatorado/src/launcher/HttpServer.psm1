# Mestre do PC V8 — Servidor HTTP com Segurança
# Refatorado: CORS restrito, auth por token, rate limiting, HTTPS opcional

Import-Module "$PSScriptRoot\Logger.psm1" -Force
Import-Module "$PSScriptRoot\JobManager.psm1" -Force
Import-Module "$PSScriptRoot\..\security\SecurityConfig.psm1" -Force

$script:ServerConfig = $null
$script:RateLimitStore = [hashtable]::Synchronized(@{})
$script:ApiTokens = [hashtable]::Synchronized(@{})

function Start-MpcServer {
    param(
        [Parameter(Mandatory)]
        [string]$ConfigPath
    )
    
    $script:ServerConfig = Get-Content $ConfigPath | ConvertFrom-Json
    
    # Inicializar subsistemas
    Initialize-Logger -LogDirectory $script:ServerConfig.logDirectory
    Initialize-JobManager -MinRunspaces 2 -MaxRunspaces $script:ServerConfig.maxJobs
    Initialize-SecurityConfig -Config $script:ServerConfig
    Initialize-RateLimit
    
    # Configurar listener
    $listener = New-Object System.Net.HttpListener
    $hostAddr = if ($script:ServerConfig.host) { $script:ServerConfig.host } else { "localhost" }
    $prefix = "http://$($hostAddr):$($script:ServerConfig.port)/"
    $listener.Prefixes.Add($prefix)
    
    try {
        $listener.Start()
        Write-Log -Level INFO -Message "Servidor iniciado em $prefix" -Source "HttpServer"
        if ([System.Environment]::UserInteractive -and -not ([System.Diagnostics.Process]::GetCurrentProcess().MainWindowHandle -eq 0)) {
            Write-Host "Servidor iniciado em $prefix"
        }
        
        # Loop principal
        while ($listener.IsListening) {
            $context = $listener.GetContext()
            [void][System.Threading.Tasks.Task]::Run({
                param($ctx)
                Process-MpcRequest -Context $ctx
            }, $context)
        }
    } finally {
        $listener.Stop()
        $listener.Close()
        Stop-JobManager
        Write-Log -Level INFO -Message "Servidor encerrado" -Source "HttpServer"
    }
}

function Process-MpcRequest {
    param([System.Net.HttpListenerContext]$Context)
    
    $request = $Context.Request
    $response = $Context.Response
    $clientIP = $request.RemoteEndPoint.Address.ToString()
    
    # CORS Headers
    if ($script:ServerConfig.cors -and $script:ServerConfig.cors.enabled) {
        $origin = $request.Headers["Origin"]
        $allowed = $script:ServerConfig.cors.allowedOrigins | Where-Object { $_ -eq $origin }
        if (-not $allowed) { $origin = $script:ServerConfig.cors.allowedOrigins[0] }
        $response.Headers.Add("Access-Control-Allow-Origin", $origin)
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    }
    
    # Preflight
    if ($request.HttpMethod -eq "OPTIONS") {
        $response.StatusCode = 204
        $response.Close()
        return
    }
    
    # Rate Limiting
    if (-not (Test-RateLimit -IP $clientIP)) {
        Send-JsonResponse -Context $Context -StatusCode 429 -Data @{ error = "Rate limit exceeded. Try again later." }
        return
    }
    
    # Autenticação
    if ($script:ServerConfig.apiAuth -and $script:ServerConfig.apiAuth.enabled) {
        $authHeader = $request.Headers["Authorization"]
        if (-not (Test-ApiToken -Header $authHeader)) {
            Send-JsonResponse -Context $Context -StatusCode 401 -Data @{ error = "Unauthorized" }
            return
        }
    }
    
    # Roteamento
    $path = $request.RawUrl -replace '^/api', ''
    $method = $request.HttpMethod
    
    try {
        switch -Regex ($path) {
            '^/ping$' { Send-JsonResponse -Context $Context -Data @{ status = "ok" } }
            '^/health$' { Handle-Health -Context $Context }
            '^/status$' { Handle-Status -Context $Context }
            '^/command$' {
                if ($method -eq 'POST') { Handle-Command -Context $Context }
                else { Send-MethodNotAllowed -Context $Context }
            }
            '^/jobs/([a-f0-9-]+)$' { Handle-JobStatus -Context $Context -JobId $Matches[1] }
            # Rotas legadas V7 para compatibilidade com MCP
            '^/run$' {
                if ($method -eq 'POST') { Handle-LegacyRun -Context $Context }
                else { Send-MethodNotAllowed -Context $Context }
            }
            '^/run-status$' {
                if ($method -eq 'GET' -or $method -eq 'POST') { Handle-LegacyRunStatus -Context $Context }
                else { Send-MethodNotAllowed -Context $Context }
            }
            '^/$' {
                if ($method -eq 'GET') { Serve-StaticFile -Context $Context -RelativePath "index.html" -ContentType "text/html" }
                else { Send-MethodNotAllowed -Context $Context }
            }
            '^/static/(.*)$' {
                if ($method -eq 'GET') {
                    $filePath = $Matches[1]
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $mimeMap = @{
                        '.html' = 'text/html'
                        '.css'  = 'text/css'
                        '.js'   = 'application/javascript'
                        '.json' = 'application/json'
                        '.png'  = 'image/png'
                        '.jpg'  = 'image/jpeg'
                        '.svg'  = 'image/svg+xml'
                    }
                    $ct = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { 'application/octet-stream' }
                    Serve-StaticFile -Context $Context -RelativePath $filePath -ContentType $ct
                }
                else { Send-MethodNotAllowed -Context $Context }
            }
            default { Send-JsonResponse -Context $Context -StatusCode 404 -Data @{ error = "Not found" } }
        }
    } catch {
        Write-Log -Level ERROR -Message "Erro no request: $($_.Exception.Message)" -Source "HttpServer"
        Send-JsonResponse -Context $Context -StatusCode 500 -Data @{ error = "Internal server error" }
    }
}

function Handle-Health {
    param([System.Net.HttpListenerContext]$Context)
    Send-JsonResponse -Context $Context -Data @{
        status = "ok"
        version = "8.0.0"
        timestamp = (Get-Date -Format "o")
        activeJobs = (Get-ActiveJobCount)
    }
}

function Handle-Status {
    param([System.Net.HttpListenerContext]$Context)
    $mem = Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
    $disk = Get-PSDrive C | Select-Object Used, Free
    
    Send-JsonResponse -Context $Context -Data @{
        cpu = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue
        memory = @{
            total = $mem.TotalVisibleMemorySize
            free = $mem.FreePhysicalMemory
            percent = [math]::Round((1 - ($mem.FreePhysicalMemory / $mem.TotalVisibleMemorySize)) * 100, 2)
        }
        disk = @{
            used = $disk.Used
            free = $disk.Free
        }
        uptime = [math]::Round(((Get-Date) - [datetime](Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalHours, 2)
        activeJobs = (Get-ActiveJobCount)
    }
}

function Handle-Command {
    param([System.Net.HttpListenerContext]$Context)
    
    $reader = New-Object System.IO.StreamReader($Context.Request.InputStream)
    $body = $reader.ReadToEnd()
    $reader.Close()
    
    try { $data = $body | ConvertFrom-Json } catch {
        Send-JsonResponse -Context $Context -StatusCode 400 -Data @{ error = "Invalid JSON" }
        return
    }
    
    if (-not $data.command) {
        Send-JsonResponse -Context $Context -StatusCode 400 -Data @{ error = "Missing 'command' field" }
        return
    }
    
    # Validação de segurança
    $validation = Test-SafeCommand -Command $data.command
    if (-not $validation.IsSafe) {
        Write-Log -Level WARN -Message "Comando bloqueado: $validation.Reason" -Source "HttpServer" -Metadata @{ command = $data.command }
        Send-JsonResponse -Context $Context -StatusCode 403 -Data @{
            error = "Command blocked: $($validation.Reason)"
            details = $validation
        }
        return
    }
    
    $timeout = if ($null -ne $data.timeoutSeconds) { $data.timeoutSeconds } else { 900 }
    $job = New-CommandJob -CommandText $data.command -TimeoutSeconds $timeout
    
    Send-JsonResponse -Context $Context -StatusCode 202 -Data @{
        jobId = $job.Id
        state = $job.State
        message = "Command accepted and queued"
    }
}

function Handle-JobStatus {
    param(
        [System.Net.HttpListenerContext]$Context,
        [string]$JobId
    )
    
    $job = Get-CommandJob -JobId $JobId
    if (-not $job) {
        Send-JsonResponse -Context $Context -StatusCode 404 -Data @{ error = "Job not found" }
        return
    }
    
    Send-JsonResponse -Context $Context -Data @{
        jobId = $job.Id
        state = $job.State
        startedAt = $job.StartedAt
        completedAt = $job.CompletedAt
        success = $job.Success
        exitCode = $job.ExitCode
        output = $job.Output
    }
}

function Handle-LegacyRun {
    param([System.Net.HttpListenerContext]$Context)
    
    $reader = New-Object System.IO.StreamReader($Context.Request.InputStream)
    $body = $reader.ReadToEnd()
    $reader.Close()
    
    try { $data = $body | ConvertFrom-Json } catch {
        Send-JsonResponse -Context $Context -StatusCode 400 -Data @{ success = $false; output = "Invalid JSON" }
        return
    }
    
    if (-not $data.cmd) {
        Send-JsonResponse -Context $Context -StatusCode 400 -Data @{ success = $false; output = "Missing 'cmd' field" }
        return
    }
    
    # Validação de segurança
    $validation = Test-SafeCommand -Command $data.cmd
    if (-not $validation.IsSafe) {
        Write-Log -Level WARN -Message "Comando bloqueado (legado): $($validation.Reason)" -Source "HttpServer" -Metadata @{ command = $data.cmd }
        Send-JsonResponse -Context $Context -StatusCode 403 -Data @{
            success = $false
            accepted = $false
            output = "Command blocked: $($validation.Reason)"
        }
        return
    }
    
    $timeout = if ($null -ne $data.timeoutSeconds) { $data.timeoutSeconds } else { 900 }
    $job = New-CommandJob -CommandText $data.cmd -TimeoutSeconds $timeout
    
    Send-JsonResponse -Context $Context -StatusCode 202 -Data @{
        success = $true
        accepted = $true
        jobId = $job.Id
        message = "Command accepted and queued"
    }
}

function Handle-LegacyRunStatus {
    param([System.Net.HttpListenerContext]$Context)
    
    $jobId = $null
    
    # Suporta GET (?id=...) e POST (body JSON)
    if ($Context.Request.HttpMethod -eq "GET") {
        $query = $Context.Request.Url.Query
        if ($query -match '\?id=([a-f0-9-]+)') {
            $jobId = $Matches[1]
        }
    } else {
        $reader = New-Object System.IO.StreamReader($Context.Request.InputStream)
        $body = $reader.ReadToEnd()
        $reader.Close()
        try {
            $data = $body | ConvertFrom-Json
            $jobId = $data.jobId
        } catch {
            Send-JsonResponse -Context $Context -StatusCode 400 -Data @{ success = $false; output = "Invalid JSON" }
            return
        }
    }
    
    if (-not $jobId) {
        Send-JsonResponse -Context $Context -StatusCode 400 -Data @{ success = $false; output = "Missing 'jobId' parameter" }
        return
    }
    
    $job = Get-CommandJob -JobId $jobId
    if (-not $job) {
        Send-JsonResponse -Context $Context -StatusCode 404 -Data @{ success = $false; output = "Job not found" }
        return
    }
    
    $isRunning = $job.State -eq "running"
    $result = @{
        success = ($job.State -eq "completed")
        done = (-not $isRunning)
        running = $isRunning
        state = $job.State
        exitCode = $job.ExitCode
        output = if ($isRunning) { "Job ainda em execucao..." } else { $job.Output }
    }
    
    Send-JsonResponse -Context $Context -Data $result
}

function Serve-StaticFile {
    param(
        [System.Net.HttpListenerContext]$Context,
        [string]$RelativePath,
        [string]$ContentType = "application/octet-stream"
    )
    $staticRoot = Join-Path $PSScriptRoot "..\..\src\frontend"
    $fullPath = Join-Path $staticRoot $RelativePath
    $fullPath = [System.IO.Path]::GetFullPath($fullPath)
    $staticRoot = [System.IO.Path]::GetFullPath($staticRoot)
    
    # Seguranca: nao servir fora do staticRoot
    if (-not $fullPath.StartsWith($staticRoot)) {
        Send-JsonResponse -Context $Context -StatusCode 403 -Data @{ error = "Forbidden" }
        return
    }
    
    if (-not (Test-Path $fullPath -PathType Leaf)) {
        Send-JsonResponse -Context $Context -StatusCode 404 -Data @{ error = "Not found" }
        return
    }
    
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $Context.Response.StatusCode = 200
    $Context.Response.ContentType = $ContentType
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.Close()
}

function Initialize-RateLimit {
    # Rate limiter simples: max X requests per minute por IP
    $script:RateLimitConfig = @{
        windowSeconds = 60
        maxRequests = 100
    }
}

function Test-RateLimit {
    param([string]$IP)
    $now = Get-Date
    $windowStart = $now.AddSeconds(-$script:RateLimitConfig.windowSeconds)
    
    if (-not $script:RateLimitStore[$IP]) {
        $script:RateLimitStore[$IP] = @()
    }
    
    # Limpar entradas antigas
    $script:RateLimitStore[$IP] = $script:RateLimitStore[$IP] | Where-Object { $_ -ge $windowStart }
    
    if ($script:RateLimitStore[$IP].Count -ge $script:RateLimitConfig.maxRequests) {
        return $false
    }
    
    $script:RateLimitStore[$IP] += $now
    return $true
}

function Test-ApiToken {
    param([string]$Header)
    if (-not $Header) { return $false }
    if (-not $Header.StartsWith("Bearer ")) { return $false }
    $token = $Header.Substring(7)
    return $script:ApiTokens.ContainsKey($token)
}

function Send-JsonResponse {
    param(
        [System.Net.HttpListenerContext]$Context,
        [int]$StatusCode = 200,
        [object]$Data
    )
    $json = $Data | ConvertTo-Json -Depth 5 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = "application/json"
    $Context.Response.ContentLength64 = $buffer.Length
    $Context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
    $Context.Response.Close()
}

function Send-MethodNotAllowed {
    param([System.Net.HttpListenerContext]$Context)
    $Context.Response.StatusCode = 405
    $Context.Response.Headers.Add("Allow", "GET, POST, OPTIONS")
    $Context.Response.Close()
}

Export-ModuleMember -Function Start-MpcServer, Process-MpcRequest
