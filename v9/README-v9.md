# Mestre do PC V9

Versão autônoma do "Mestre do PC" — frontend single-page (design Neo Tokyo) + launcher Node.js + chat Ollama ativo por padrão.

## Requisitos
- Node.js 20+
- Ollama (opcional, mas recomendado para o chat de IA) — https://ollama.com

## Como ativar
1. Dê duplo clique em `start-v9.bat` (ou execute `npm start`).
2. O launcher sobe em `http://127.0.0.1:18792`.
3. O navegador NÃO abre automaticamente — acesse manualmente: http://127.0.0.1:18792

## Porta
- Default: `18792`
- Override via env: `MPC_PORT=19000 node launcher.js`

## Endpoints
- `GET /ping` — heartbeat + estado (idle/busy)
- `GET /mcp-status` — compat MCP
- `GET /status` — métricas CPU/RAM/Disco/uptime
- `POST /run` `{cmd}` — cria job PowerShell → `{jobId}`
- `GET /run-status?id=<jobId>` — status do job
- `GET /ollama/tags` — proxy para `127.0.0.1:11434/api/tags`
- `POST /ollama/chat` — proxy streaming para `/api/chat`
- `POST /ollama/pull` — proxy para `/api/pull`

## Chat Ollama
- Ativo por padrão (botão "AI" no canto inferior direito).
- Seletor de modelo (dropdown) populado via `/ollama/tags`.
- Status mostra 🟢 conectado / 🔴 offline (modal permanece utilizável mesmo offline).
- Streaming de resposta + renderização de markdown básica com botão "Executar" em blocos de código (chama `/run`).

## Segurança
- Sanitização bloqueia `rm -rf`, `format`, `del /f /s /q C:` (HTTP 403).
- Rate limit: 120 req/min por IP.
- CORS `*` (uso local).