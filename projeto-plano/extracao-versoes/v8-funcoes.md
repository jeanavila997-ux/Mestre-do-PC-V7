# Mestre do PC V8 - Preview
## Visao Geral
Interface moderna com cards 3D, dashboard de metricas, log de atividades, terminal e chat IA Ollama. Conecta ao launcher HTTP via endpoints /ping, /run, /run-status, /status, /ollama/tags, /ollama/chat.
## Funcoes JavaScript
- nowTime(): retorna hora local no formato pt-BR.
- log(msg, type): adiciona entrada no terminal de logs.
- renderCards(): renderiza cards de Otimizacao e Ferramentas com efeito 3D.
- runCommand(cmd, label, card): envia comando para /run e inicia polling.
- pollJob(jobId, label, card): consulta /run-status ate conclusao.
- checkPing(): verifica saude do launcher via /ping.
- loadMetrics(): busca /status e renderiza CPU, RAM, disco e temperatura.
- openTerminal(): abre terminal enviando comando inicial.
- checkOllama(): lista modelos disponiveis e preenche select.
- escapeHtml(s): escapa caracteres HTML.
- renderMarkdown(text): converte markdown basico e blocos de codigo.
- addMsg(role, text): adiciona mensagem ao chat IA.
- sendChat(): envia mensagem para /ollama/chat com streaming.
- init(): inicializa app, listeners e intervalos.
- make(): helper interno para criar cards (arrow function).

## Comandos PowerShell

### Otimizacao: Limpeza Rapida
```powershell
Remove-Item "$env:TEMP\*" -Recurse -Force -EA 0; Remove-Item "C:\Windows\Temp\*" -Recurse -Force -EA 0; Clear-RecycleBin -Force -EA 0; Write-Host "Limpeza concluida!" -ForegroundColor Green
```

### Otimizacao: Liberar RAM
```powershell
[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers(); Write-Host "RAM liberada!" -ForegroundColor Green
```

### Otimizacao: Reparar Sistema
```powershell
sfc /scannow; DISM /Online /Cleanup-Image /RestoreHealth
```

### Ferramentas: Windows Defender
```powershell
Get-MpComputerStatus | Select-Object AMRunningMode,AntivirusEnabled,RealTimeProtectionEnabled | Format-List; Start-MpScan -ScanType QuickScan
```

### Ferramentas: Diagnostico de Rede
```powershell
ipconfig /flushdns; ipconfig /release; ipconfig /renew; Test-Connection 8.8.8.8 -Count 2 | Format-Table -AutoSize
```

### Ferramentas: Informacoes do Sistema
```powershell
Get-ComputerInfo | Select-Object WindowsProductName,WindowsVersion,OsArchitecture,CsName,CsProcessors | Format-List
```

### Ferramentas: Espaco em Disco
```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N="Usado(GB)";E={[math]::Round(($_.Used/1GB),2)}},@{N="Livre(GB)";E={[math]::Round(($_.Free/1GB),2)}},@{N="Total(GB)";E={[math]::Round((($_.Used+$_.Free)/1GB),2)}} | Format-Table -AutoSize
```

## Constantes Importantes
- API endpoints: /ping, /run, /run-status, /status, /ollama/tags, /ollama/chat
- SYSTEM_PROMPT: define personalidade do Mestre do PC em portugues brasileiro.
