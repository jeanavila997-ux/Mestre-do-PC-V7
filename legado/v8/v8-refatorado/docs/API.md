# API Reference — Mestre do PC V8

Base URL: `http://localhost:18791`

## GET /api/health

Health check basico.

**Response 200:**
```json
{
  "status": "ok",
  "version": "8.0.0",
  "timestamp": "2026-04-26T16:00:00Z",
  "activeJobs": 0
}
```

## GET /api/status

Status completo do sistema.

**Response 200:**
```json
{
  "cpu": 12.5,
  "memory": {
    "total": 16777216,
    "free": 8388608,
    "percent": 50.0
  },
  "disk": {
    "used": 250000000000,
    "free": 500000000000
  },
  "uptime": 48.5,
  "activeJobs": 1
}
```

## POST /api/command

Executa um comando PowerShell validado.

**Request:**
```json
{
  "command": "Get-Process | Select-Object -First 5 Name,CPU",
  "timeoutSeconds": 900
}
```

**Response 202 (Aceito):**
```json
{
  "jobId": "a1b2c3d4...",
  "state": "running",
  "message": "Command accepted and queued"
}
```

**Response 403 (Bloqueado):**
```json
{
  "error": "Command blocked: Comando nao permitido: 'Format-Volume'",
  "details": {
    "IsSafe": false,
    "Reason": "Comando nao permitido: 'Format-Volume'",
    "Category": "not_allowed",
    "Score": 0
  }
}
```

**Response 400:**
```json
{ "error": "Missing 'command' field" }
```

## GET /api/jobs/{id}

Consulta status de um job.

**Response 200 (running):**
```json
{
  "jobId": "a1b2c3d4...",
  "state": "running",
  "startedAt": "2026-04-26T16:00:00Z",
  "completedAt": null,
  "success": null,
  "exitCode": null,
  "output": ""
}
```

**Response 200 (completed):**
```json
{
  "jobId": "a1b2c3d4...",
  "state": "completed",
  "startedAt": "2026-04-26T16:00:00Z",
  "completedAt": "2026-04-26T16:00:05Z",
  "success": true,
  "exitCode": 0,
  "output": "..."
}
```

## Rotas Legadas V7

Para compatibilidade com o MCP Server V7.

### POST /run

**Request:**
```json
{ "cmd": "Get-Date" }
```

**Response 202:**
```json
{
  "success": true,
  "accepted": true,
  "jobId": "a1b2c3d4...",
  "message": "Command accepted and queued"
}
```

### GET /run-status?id={jobId}

**Response:**
```json
{
  "success": true,
  "done": true,
  "running": false,
  "state": "completed",
  "exitCode": 0,
  "output": "..."
}
```

## Erros Comuns

| Status | Causa |
|--------|--------|
| 400 | JSON invalido ou campo obrigatorio faltando |
| 401 | Token de autenticacao invalido |
| 403 | Comando bloqueado pela seguranca |
| 404 | Job ou recurso nao encontrado |
| 405 | Metodo HTTP nao permitido |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |
