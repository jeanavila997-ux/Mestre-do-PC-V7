# Servidor MCP do Mestre do PC V7

Este servidor permite que IAs como o **Claude Desktop** executem comandos de limpeza, diagnóstico e otimização **diretamente no seu computador** via MCP (Model Context Protocol).

## Pré-requisitos

1. **Node.js** — [nodejs.org](https://nodejs.org/)
2. **MestreDoPC-Launcher.ps1** rodando como Administrador (porta 7777)

## Instalar Dependências

```bash
cd mcp-server
npm install
```

## Configurar no Claude Desktop

Abra `%APPDATA%\Claude\claude_desktop_config.json` e adicione:

```json
{
  "mcpServers": {
    "mestre_do_pc": {
      "command": "node",
      "args": ["C:\\MestreDoPC_V7\\mcp-server\\index.js"],
      "env": {
        "MESTRE_PROJETO_PATH": "C:\\MestreDoPC_V7"
      }
    }
  }
}
```

> Substitua `C:\\MestreDoPC_V7` pelo caminho real de instalação. Use `\\` (barras duplas) no JSON.

Reinicie o Claude Desktop. Um ícone de "Ferramentas" confirmará a conexão.

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `MESTRE_PROJETO_PATH` | `C:\MestreDoPC_V7` | Pasta do projeto para comandos `git status`/`git pull` |

## Ferramentas Disponíveis

- **Limpeza** — TEMP, lixeira, cache WU, prefetch, DNS, logs de eventos
- **RAM** — uso atual, liberar memória, listar processos
- **Disco** — espaço, saúde SMART, desfragmentar, TRIM SSD
- **Rede** — diagnóstico, flush DNS, renovar IP, reset TCP/IP
- **Reparo** — SFC scannow, DISM RestoreHealth, reparar WU
- **Segurança** — Windows Defender, firewall, scan rápido/completo
- **Processos** — encerrar por nome, reiniciar Explorer
- **IA** — perguntar ao Ollama, analisar logs com IA

## Exemplos de Uso no Claude

- *"Qual o uso de memória RAM agora?"*
- *"Faça uma limpeza rápida no sistema"*
- *"Encerre o processo chrome"*
- *"Analise os logs de erro e diga o que está errado"*
- *"Faça um diagnóstico completo do PC"*
