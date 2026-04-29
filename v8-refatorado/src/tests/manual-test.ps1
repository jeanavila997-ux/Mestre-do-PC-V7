$projectPath = 'C:\Users\Jeanc\MestreDoPC_V7\v8-refatorado'
$stdOut = Join-Path $projectPath 'logs\manual-test-out.log'
$stdErr = Join-Path $projectPath 'logs\manual-test-err.log'
if (Test-Path $stdOut) { Remove-Item $stdOut }
if (Test-Path $stdErr) { Remove-Item $stdErr }

$proc = Start-Process -FilePath 'pwsh' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"`u0026 '$projectPath\MestreDoPC-Launcher.ps1'`"" -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdOut -RedirectStandardError $stdErr
Start-Sleep -Seconds 5
if ($proc.HasExited) {
    Write-Host "Processo encerrou (exit: $($proc.ExitCode))"
    Write-Host "--- STDOUT ---"
    Get-Content $stdOut -ErrorAction SilentlyContinue
    Write-Host "--- STDERR ---"
    Get-Content $stdErr -ErrorAction SilentlyContinue
} else {
    Write-Host "Processo ainda rodando (PID: $($proc.Id)). Testando..."
    try {
        $r = Invoke-RestMethod -Uri 'http://127.0.0.1:18791/ping' -TimeoutSec 3
        Write-Host "RESPOSTA: $($r | ConvertTo-Json)" -ForegroundColor Green
    } catch {
        Write-Host "Falha: $_" -ForegroundColor Red
    }
    Write-Host "Encerrando..."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
