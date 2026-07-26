# Mestre do PC V8

Versão autônoma do Mestre do PC com frontend laranja, launcher Node.js próprio e chat Ollama ativo por padrão.

## Requisitos
- Node.js 20+ (ES modules)
- Ollama (opcional, mas habilita o chat de IA local — `https://ollama.com`)
- Windows 10/11 (PowerShell 5.1+)

## Ativação
Execute `start-v8.bat` (duplo clique). O launcher sobe em `http://127.0.0.1:18791` e abre o navegador automaticamente.
Alternativa: `npm start` na pasta `v8/`.

## Porta
Padrão **18791** (override via variável `MPC_PORT`).

## Endpoints principais
- `GET /ping` — health check
- `GET /status` — métricas de CPU/RAM/Disco
- `POST /run` — envia comando PowerShell (`{ "cmd": "..." }`)
- `GET /run-status?id=<jobId>` — status do job
- `GET /ollama/tags` — lista modelos instalados
- `POST /ollama/chat` — proxy streaming para o Ollama
- `POST /ollama/pull` — baixa modelo

## Chat Ollama (IA)
Ativo por padrão. Clique no botão flutuante "🤖 IA" no canto inferior direito.
No header do modal, use o `<select>` para escolher o modelo (populado via `GET /ollama/tags`).
Se o Ollama estiver offline, o modal exibe aviso mas permanece aberto.

## Estrutura
```
v8/
  index.html       <- frontend single-page
  launcher.js      <- servidor Node.js (porta 18791)
  package.json
  start-v8.bat     <- ativador
  README-v8.md
  favicon.png
```