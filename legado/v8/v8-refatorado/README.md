# Mestre do PC V8

Sistema de manutencao Windows com interface web, API REST segura e integracao MCP para IAs.

## Arquitetura

```
MestreDoPC-Launcher.ps1 (entrypoint)
  |
  +-- src/launcher/Logger.psm1      (logging estruturado JSON)
  +-- src/launcher/JobManager.psm1  (RunspacePool para jobs)
  +-- src/launcher/HttpServer.psm1  (servidor HTTP + API)
  +-- src/security/SecurityConfig.psm1 (allowlist + validacao)
  +-- src/frontend/                (SPA HTML/CSS/JS)
  +-- mcp-server/index.js           (MCP stdio para Claude)
```

## Instalacao Rapida

```powershell
# Modo interativo
.\MestreDoPC-Launcher.ps1 -Install

# Executar
.\MestreDoPC-Launcher.ps1
```

## Endpoints da API

| Metodo | Rota | Descricao |
|--------|------|------------|
| GET | `/api/health` | Health check |
| GET | `/api/status` | Status do sistema (CPU, RAM, disco) |
| POST | `/api/command` | Enviar comando PowerShell |
| GET | `/api/jobs/{id}` | Consultar status de job |
| POST | `/run` | **Legado V7** — Enviar comando |
| GET/POST | `/run-status` | **Legado V7** — Status de job |

## Seguranca

- **Allowlist**: apenas comandos PowerShell pre-aprovados sao executados
- **Pattern detection**: bloqueia Invoke-Expression, IEX, DownloadString, etc.
- **Rate limiting**: 100 req/min por IP
- **CORS restrito**: apenas origens configuradas em `config.json`
- **Auth por token** (opcional): Bearer token para API externa

## Variaveis de Ambiente (MCP)

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| `MESTRE_BASE_URL` | `http://localhost:7777` | URL do Launcher |
| `MESTRE_PROJETO_PATH` | `C:\MestreDoPC_V8` | Caminho do projeto (para git) |
| `OLLAMA_URL` | `http://localhost:11434` | URL do Ollama |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | Modelo Ollama |

## Licenca

ISC
