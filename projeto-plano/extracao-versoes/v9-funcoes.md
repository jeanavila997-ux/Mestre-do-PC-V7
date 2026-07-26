# Mestre do PC V9 - Designs
## Visao Geral
Interface futurista/cyberpunk com modulos core, dashboard de status, terminal modal e chat IA com botao EXECUTAR em blocos de codigo. Usa endpoints /ping, /run, /run-status, /status, /ollama/tags, /ollama/chat.
## Funcoes JavaScript
- nowStr(): retorna hora como HH:MM:SS.
- addLog(text, type): insere entrada no log de atividades.
- api(path, opts): wrapper de fetch generico.
- getJson(path): wrapper fetch JSON.
- pingSystem(): atualiza badge SYSTEM ONLINE/OFFLINE.
- fmtUptime(sec): formata segundos em dias/horas/minutos.
- loadStatus(): carrega CPU, RAM livre, disco livre e uptime.
- renderModules(): renderiza 6 cards de modulos core.
- runModule(m, card): envia comando do modulo e exibe no terminal.
- pollJob(jobId, title): polling de status com output ao vivo.
- sleep(ms): utilidade de espera.
- openTerminal(title): abre modal de terminal.
- setTerminal(text): define conteudo do terminal.
- setChatStatus(on): atualiza indicador online/offline.
- addMsg(role, text): adiciona mensagem ao chat.
- renderMarkdown(t): converte markdown incluindo blocos com botao EXECUTAR.
- esc(s): escapa HTML interno do renderMarkdown.
- checkOllama(): lista modelos Ollama.
- openChat(): abre chat com mensagem de boas-vindas.
- closeChat(): fecha chat.
- sendChat(): envia pergunta com historico limitado aos ultimos 12 turnos.

## Comandos PowerShell (Core Modules)

### System Clean - Purge temp files and clear system cache instantly.
```powershell
Remove-Item "$env:TEMP\*" -Recurse -Force -EA 0; Remove-Item "C:\Windows\Temp\*" -Recurse -Force -EA 0; Clear-RecycleBin -Force -EA 0; Write-Host "OK Limpeza concluida" -ForegroundColor Green
```

### RAM Boost - Free memory with .NET Garbage Collector injection.
```powershell
[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers(); Write-Host "OK RAM liberada" -ForegroundColor Green
```

### System Repair - Run SFC and DISM to fix corrupted Windows files.
```powershell
sfc /scannow; Write-Host ""; DISM /Online /Cleanup-Image /RestoreHealth; Write-Host "OK Reparo concluido" -ForegroundColor Green
```

### Network Diagnostic - ipconfig /all, flush DNS and renew IP.
```powershell
ipconfig /all; Write-Host ""; ipconfig /flushdns; ipconfig /release; ipconfig /renew; Write-Host "OK Rede renovada" -ForegroundColor Green
```

### Defender Scan - Quick scan with Windows Defender.
```powershell
Start-MpScan -ScanType QuickScan; Write-Host "OK Scan rapido iniciado" -ForegroundColor Green
```

### System Info - Show Windows product, CPU, RAM and disks.
```powershell
Get-ComputerInfo | Select-Object WindowsProductName,WindowsVersion,OsArchitecture,CsName,CsProcessors,CsTotalPhysicalMemory | Format-List; Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N="Usado(GB)";E={[math]::Round(($_.Used/1GB),2)}},@{N="Livre(GB)";E={[math]::Round(($_.Free/1GB),2)}} | Format-Table -AutoSize
```

## Diferenciais do V9
- Botao EXECUTAR embutido em blocos de codigo gerados pela IA.
- Historico de chat truncado para ultimos 12 turnos.
- Terminal modal dedicado para cada modulo.
- Design cyberpunk com neon cyan/magenta.
