# Mestre do PC V10

Aplicativo local de diagnóstico e manutenção do Windows com interface web,
launcher PowerShell elevado, integração Ollama e servidor MCP para Claude/Codex.

## Instalação no Windows

1. Instale Node.js LTS e Ollama.
2. Execute `INSTALAR.bat`.
3. Abra o atalho **Mestre do PC**.

O instalador registra o launcher como tarefa agendada, instala as dependências
de `mcp-server/`, configura o MCP e cria os atalhos da V10.

## Arquitetura

- `v10/index.html`: interface ativa.
- `MestreDoPC-Launcher.ps1`: servidor administrativo em
  `http://127.0.0.1:7777`.
- `mcp-server/index.js`: servidor MCP por `stdio`.
- Ollama: API local em `http://127.0.0.1:11434`.
- `legado/`: versões V7, V8 e V9 arquivadas.

A interface deve ser aberta pelo atalho ou por `v10\start-v10.bat`. O launcher
serve a página na mesma origem e protege os endpoints administrativos contra
chamadas de páginas externas.

## Desenvolvimento

```powershell
cd mcp-server
npm ci
npm test
node --check index.js
```

Consulte [docs/INSTALACAO-CLIENTE.md](docs/INSTALACAO-CLIENTE.md) para o guia
completo.
