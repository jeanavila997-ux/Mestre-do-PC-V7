---
name: mestre-do-pc-v10
description: Desenvolver e validar a V10, o launcher PowerShell elevado, o MCP Node e a integração Ollama.
---

# Mestre do PC V10

## Arquitetura canônica

- Interface: `v10/index.html`
- Launcher Windows: `MestreDoPC-Launcher.ps1`
- MCP: `mcp-server/index.js`
- Testes: `mcp-server/test/*.test.js`
- Versões antigas: `legado/`

## Segurança obrigatória

- Preserve o bind em `127.0.0.1`.
- Preserve a validação de origem e `X-Mestre-Client` nos endpoints POST.
- Não use CORS `*`.
- Não envie argumentos não validados a PowerShell.
- Exija confirmação para comandos destrutivos ou sugeridos por LLM.

## Validação

```powershell
cd mcp-server
npm ci
npm test
node --check index.js
node --check ..\v10\launcher.js
```

Também valide os scripts PowerShell com o parser da linguagem e abra a V10 em
`http://127.0.0.1:7777/` para verificar console, cards, status e chat Ollama.

Use commits convencionais e mantenha caminhos configuráveis por ambiente.
