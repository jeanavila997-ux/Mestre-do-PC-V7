Import-Module "C:\Users\Jeanc\MestreDoPC_V7\v8-refatorado\src\launcher\Logger.psm1" -Force
if (Get-Command Initialize-Logger -ErrorAction SilentlyContinue) { Write-Host "FOUND" } else { Write-Host "NOT FOUND" }
