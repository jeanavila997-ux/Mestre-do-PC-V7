$projectPath = "C:\Users\Jeanc\MestreDoPC_V7\v8-refatorado"
$logFile = Join-Path $projectPath "logs\server-debug.log"

# Limpar log anterior
if (Test-Path $logFile) { Remove-Item $logFile -Force }

# Tentar iniciar o servidor e capturar erros
try {
    Set-Location $projectPath
    Import-Module "$projectPath\src\launcher\Logger.psm1" -Force
    Import-Module "$projectPath\src\launcher\JobManager.psm1" -Force
    Import-Module "$projectPath\src\launcher\HttpServer.psm1" -Force
    Import-Module "$projectPath\src\security\SecurityConfig.psm1" -Force
    
    "Modulos importados com sucesso" | Out-File $logFile -Append
    
    Initialize-Logger -LogDirectory "$projectPath\logs"
    "Logger inicializado" | Out-File $logFile -Append
    
    $config = Get-Content "$projectPath\src\config\config.json" | ConvertFrom-Json
    Initialize-SecurityConfig -Config $config
    "SecurityConfig inicializado" | Out-File $logFile -Append
    
    "Iniciando servidor..." | Out-File $logFile -Append
    Start-MpcServer -ConfigPath "$projectPath\src\config\config.json"
} catch {
    "ERRO: $_" | Out-File $logFile -Append
    "Stack: $($_.ScriptStackTrace)" | Out-File $logFile -Append
}
