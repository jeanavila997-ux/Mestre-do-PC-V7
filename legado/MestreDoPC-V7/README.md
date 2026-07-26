# MestreDoPC V7 - MCP Server

Um servidor MCP (Model Context Protocol) que expõe ferramentas de manutenção do Windows para assistentes de IA (Claude Desktop, etc.) via RPC.

## Arquitetura

```
IA Client (Claude) ←→ MCP Server (Node.js) ←→ MestreDoPC-Launcher.ps1 (HTTP:7777) ←→ Windows Tools
                                              ↓
                                         Ollama (IA local)
```

## Funcionalidades

- **Limpeza de sistema**: Esvaziar lixeira, limpar caches, remover arquivos temporários
- **Diagnóstico**: Consultar uso de RAM, status de disco, analisar logs
- **Reparo**: Executar `sfc /scannow`, resetar Windows Update
- **IA local**: Integração com Ollama para análise inteligente de logs

## Instalação

```bash
# Instalar dependências
npm install

# Build
npm run build

# Desenvolvimento (watch mode)
npm run dev
```

## Uso

### Modo Normal

```bash
# Iniciar servidor MCP
npm start
```

### Modo Simulation (Desenvolvimento)

```bash
# Loga comandos sem executar
export SIMULATION_MODE=true
npm start
```

## Ferramentas Disponíveis

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `limpeza_rapida_completa` | Limpeza geral do sistema | `dryRun` (bool) |
| `liberar_memoria_ram` | Libera memória RAM | `targetMB` (int) |
| `analizar_logs_sistema` | Analisa logs com IA | `logName`, `entryType`, `hours` |
| `perguntar_ia` | Pergunta para Ollama | `prompt` (required), `model`, `maxTokens` |
| `verificar_disco` | Verifica integridade do disco | `driveLetter` (required), `fixErrors` |
| `reset_windows_update` | Reseta Windows Update | `confirm` (bool) |

## Configuração

### Variáveis de Ambiente

```bash
# URL do launcher (default: http://localhost:7777)
LAUNCHER_URL=http://localhost:7777

# Nível de log (debug, info, warn, error)
LOG_LEVEL=info

# Modo simulation (não executa comandos)
SIMULATION_MODE=true
```

### Integração com Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mestredopc": {
      "command": "node",
      "args": ["C:\\Users\\Jeanc\\MestreDoPC-V7\\dist\\index.js"],
      "env": {
        "LAUNCHER_URL": "http://localhost:7777"
      }
    }
  }
}
```

## Segurança

### Características de Segurança

- ✅ **Sanitização de comandos**: Escape de caracteres especiais (`;`, `&`, `|`, `>`, `<`, `$`, `` ` ``)
- ✅ **Whitelist de parâmetros**: Validação rigorosa por ferramenta
- ✅ **Detecção de injeção**: Bloqueio de padrões suspeitos
- ✅ **EncodedCommand**: Comandos codificados em Base64 (UTF-16LE)
- ✅ **Timeout configurável**: Previne execução infinita
- ✅ **Retry com backoff**: Resiliência a falhas transitórias

### Testes de Injeção

```bash
# Teste: tentar injetar comando destrutivo
# Deve ser bloqueado ou escapado
{
  "tool": "limpeza_rapida_completa",
  "params": {
    "dryRun": "true; rm -rf /"
  }
}
```

Veja [SECURITY.md](./SECURITY.md) para detalhes.

## Testes

```bash
# Rodar testes
npm test

# Com coverage
npm run test:coverage

# Verificação de tipos
npm run typecheck
```

## Desenvolvimento

### Estrutura do Projeto

```
MestreDoPC-V7/
├── src/
│   ├── index.ts              # Entry point MCP
│   ├── launcher-client.ts    # Cliente HTTP do launcher
│   ├── logger.ts             # Logger estruturado (Pino)
│   └── security/
│       ├── sanitizer.ts      # Escape de comandos
│       └── whitelist.ts      # Validação de parâmetros
├── tests/
│   ├── unit/
│   │   ├── sanitizer.test.ts
│   │   └── whitelist.test.ts
│   └── fixtures/
├── docs/
└── package.json
```

### Comandos Úteis

```bash
# Build
npm run build

# Dev com watch
npm run dev

# Lint
npm run lint
npm run lint:fix

# Format
npm run format

# Type check
npm run typecheck
```

## Troubleshooting

### Launcher não responde

```bash
# Verificar se launcher está rodando
curl http://localhost:7777/run-status?jobId=test

# Reiniciar launcher
.\MestreDoPC-Launcher.ps1
```

### Erro de timeout

Aumente o timeout no `launcher-client.ts`:

```typescript
const DEFAULT_TIMEOUT_MS = 60000; // 60 segundos
```

## Próximos Passos (V7.1)

- [ ] Named Pipes em vez de HTTP (`\\.\pipe\MestreDoPC`)
- [ ] Autenticação por token
- [ ] Rate limiting por client
- [ ] Métricas e monitoramento (Prometheus)
- [ ] Ferramentas adicionais (backup, restore)

## Licença

MIT
