$projectPath = "C:\Users\Jeanc\MestreDoPC_V7\v8-refatorado"
$logFile = Join-Path $projectPath "logs\e2e-test.log"

function Write-TestLog {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts [$Level] $Message" | Tee-Object -FilePath $logFile -Append
}

if (Test-Path $logFile) { Remove-Item $logFile -Force }
Write-TestLog "Iniciando E2E Test..."

# Iniciar servidor em um Runspace (thread separada, mesmo processo)
$runspace = [runspacefactory]::CreateRunspace()
$runspace.Open()
$ps = [powershell]::Create()
$ps.Runspace = $runspace

[void]$ps.AddScript(@"
    `$ErrorActionPreference = "Stop"
    `$projectPath = "$projectPath"
    Import-Module "`$projectPath\src\launcher\Logger.psm1" -Force
    Import-Module "`$projectPath\src\launcher\JobManager.psm1" -Force
    Import-Module "`$projectPath\src\launcher\HttpServer.psm1" -Force
    Import-Module "`$projectPath\src\security\SecurityConfig.psm1" -Force
    Initialize-Logger -LogDirectory "`$projectPath\logs"
    Initialize-SecurityConfig -Config (Get-Content "`$projectPath\src\config\config.json" | ConvertFrom-Json)
    Start-MpcServer -ConfigPath "`$projectPath\src\config\config.json"
"@)

$asyncResult = $ps.BeginInvoke()
Write-TestLog "Servidor iniciado em runspace"

# Aguardar servidor ficar pronto
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:18791/ping" -TimeoutSec 2 -ErrorAction Stop
        if ($r.status -eq "ok") { $ready = $true; break }
    } catch { }
}

if (-not $ready) {
    Write-TestLog "Servidor nao respondeu em 20s" "ERROR"
    try { $ps.Stop(); $runspace.Close() } catch {}
    exit 1
}
Write-TestLog "Servidor respondendo em http://127.0.0.1:18791" "OK"

$failures = 0

# /health
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:18791/health" -TimeoutSec 5
    if ($h.status -eq "ok" -and $h.version -eq "8.0.0") {
        Write-TestLog "GET /health -> OK (version: $($h.version))" "OK"
    } else {
        Write-TestLog "GET /health -> resposta inesperada" "WARN"; $failures++
    }
} catch { Write-TestLog "GET /health -> FALHA: $_" "ERROR"; $failures++ }

# /status
try {
    $s = Invoke-RestMethod -Uri "http://127.0.0.1:18791/status" -TimeoutSec 5
    if ($s.cpu -ne $null -and $s.memory -ne $null) {
        Write-TestLog "GET /status -> OK (cpu: $($s.cpu))" "OK"
    } else { Write-TestLog "GET /status -> incompleta" "WARN"; $failures++ }
} catch { Write-TestLog "GET /status -> FALHA: $_" "ERROR"; $failures++ }

# POST /command
try {
    $c = Invoke-RestMethod -Uri "http://127.0.0.1:18791/command" -Method POST -Body '{"command":"Get-Process -Name pwsh | Select-Object -First 1"}' -ContentType "application/json" -TimeoutSec 10
    if ($c.jobId -and $c.state -eq "queued") {
        Write-TestLog "POST /command -> OK (jobId: $($c.jobId))" "OK"
        Start-Sleep -Seconds 2
        $j = Invoke-RestMethod -Uri "http://127.0.0.1:18791/jobs/$($c.jobId)" -TimeoutSec 5
        Write-TestLog "GET /jobs/$($c.jobId) -> state: $($j.state)" "OK"
    } else { Write-TestLog "POST /command -> resposta inesperada" "WARN"; $failures++ }
} catch { Write-TestLog "POST /command -> FALHA: $_" "ERROR"; $failures++ }

# POST /run (legacy)
try {
    $l = Invoke-RestMethod -Uri "http://127.0.0.1:18791/run" -Method POST -Body '{"cmd":"Get-Date"}' -ContentType "application/json" -TimeoutSec 10
    if ($l.success -eq $true -and $l.accepted -eq $true) {
        Write-TestLog "POST /run (legacy) -> OK (jobId: $($l.jobId))" "OK"
    } else { Write-TestLog "POST /run (legacy) -> inesperado" "WARN"; $failures++ }
} catch { Write-TestLog "POST /run (legacy) -> FALHA: $_" "ERROR"; $failures++ }

# GET / (index.html)
try {
    $static = Invoke-WebRequest -Uri "http://127.0.0.1:18791/" -TimeoutSec 5 -UseBasicParsing
    if ($static.Content -match "html" -or $static.Content -match "Mestre do PC") {
        Write-TestLog "GET / (index.html) -> OK" "OK"
    } else { Write-TestLog "GET / (index.html) -> resposta vazia" "WARN"; $failures++ }
} catch { Write-TestLog "GET / (index.html) -> FALHA: $_" "ERROR"; $failures++ }

# Path traversal test
try {
    $evil = Invoke-RestMethod -Uri "http://127.0.0.1:18791/static/../../../Windows/System32/drivers/etc/hosts" -TimeoutSec 5 -ErrorAction Stop
    Write-TestLog "GET /static/.../hosts -> NAO BLOQUEADO" "ERROR"; $failures++
} catch {
    if ($_.Exception.Response -and ($_.Exception.Response.StatusCode.value__ -eq 403 -or $_.Exception.Response.StatusCode.value__ -eq 404)) {
        Write-TestLog "GET /static/.../hosts -> bloqueado (403/404) OK" "OK"
    } else {
        Write-TestLog "GET /static/.../hosts -> erro: $($_.Exception.Message)" "WARN"
    }
}

# Encerrar servidor
Write-TestLog "Encerrando servidor..."
try { $ps.Stop(); $runspace.Close() } catch {}
Write-TestLog "Servidor encerrado."

Write-TestLog "========================================"
if ($failures -eq 0) {
    Write-TestLog "E2E TEST: TODOS OS TESTES PASSARAM" "OK"
} else {
    Write-TestLog "E2E TEST: $failures FALHA(S)" "ERROR"
}
Write-TestLog "========================================"
