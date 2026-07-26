. "C:\Users\Jeanc\MestreDoPC_V7\v8-refatorado\src\launcher\Logger.psm1"
Write-Host "After dot-source"
if (Get-Command Initialize-Logger -ErrorAction SilentlyContinue) {
    Write-Host "Initialize-Logger found!"
    Initialize-Logger -LogDirectory "C:\Users\Jeanc\MestreDoPC_V7\v8-refatorado\logs"
    Write-Log -Level INFO -Message "Test from minimal script"
} else {
    Write-Host "Initialize-Logger NOT found"
}
