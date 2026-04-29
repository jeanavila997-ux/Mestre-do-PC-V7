param(
    [string]$InstallDir,
    [switch]$Quiet
)
$ErrorActionPreference = "Stop"
if (-not $Quiet) { Write-Host "[REGISTER] Criando tarefa agendada MestreDoPC_Admin_Launcher..." -ForegroundColor Cyan }
$psExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
$action = New-ScheduledTaskAction -Execute $psExe -Argument "-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$InstallDir\MestreDoPC-Launcher.ps1`" -Install"
$trigger = New-ScheduledTaskTrigger -AtLogon
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
try { Unregister-ScheduledTask -TaskName "MestreDoPC_Admin_Launcher" -Confirm:$false -ErrorAction SilentlyContinue | Out-Null } catch {}
Register-ScheduledTask -TaskName "MestreDoPC_Admin_Launcher" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
if (-not $Quiet) { Write-Host "[REGISTER] Tarefa criada com sucesso." -ForegroundColor Green }
