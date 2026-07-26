$projectPath = "C:\Users\Jeanc\MestreDoPC_V7\v8-refatorado"
$stdOut = Join-Path $projectPath "logs\server-stdout.log"
$stdErr = Join-Path $projectPath "logs\server-stderr.log"

# Limpar logs anteriores
if (Test-Path $stdOut) { Remove-Item $stdOut -Force }
if (Test-Path $stdErr) { Remove-Item $stdErr -Force }

# Usar pwsh.exe (PowerShell 7) em vez de powershell.exe
$pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
$exe = if ($pwsh) { $pwsh.Source } else { "powershell.exe" }

$proc = Start-Process -FilePath $exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$projectPath\src\tests\debug-server.ps1`"" -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdOut -RedirectStandardError $stdErr

Write-Host "Servidor iniciado (PID: $($proc.Id)) com $exe"
Write-Host "Aguardando 10s..."
Start-Sleep -Seconds 10

# Verificar se ainda esta rodando
if ($proc.HasExited) {
    Write-Host "Servidor ENCERROU prematuramente (exit code: $($proc.ExitCode))" -ForegroundColor Red
    Write-Host "--- STDOUT ---"
    if (Test-Path $stdOut) { Get-Content $stdOut }
    Write-Host "--- STDERR ---"
    if (Test-Path $stdErr) { Get-Content $stdErr }
} else {
    Write-Host "Servidor ainda rodando. Testando /ping..."
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:18791/ping" -TimeoutSec 5
        Write-Host "RESPOSTA: $($r | ConvertTo-Json)" -ForegroundColor Green
    } catch {
        Write-Host "FALHA: $_" -ForegroundColor Red
    }
    Write-Host "Encerrando servidor..."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
