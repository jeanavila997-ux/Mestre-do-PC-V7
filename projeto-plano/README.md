# Plano do Projeto — Mestre do PC (V7 + V8 Refatorado)

## 1. Sumário Executivo

**Mestre do PC** é uma plataforma de manutenção, diagnóstico e otimização para Windows que expõe comandos do sistema via **Model Context Protocol (MCP)** para assistentes de IA (Claude Desktop, Claude Code) e fornece uma interface web administrativa no navegador.

O repositório contém **duas gerações ativas**:
- **V7 (legado/estável)**: Launcher monolítico PowerShell na porta `7777`, MCP server canônico em `mcp-server/`.
- **V8 (refatorado/em desenvolvimento)**: Arquitetura modular PowerShell com `RunspacePool`, logging JSON estruturado, segurança reforçada (allowlist + rate limiting), API REST na porta `18791`, localizado em `v8-refatorado/`.

**Problema crítico identificado**: A raiz do repositório mistura artefatos V7 e V8. O `install.ps1` na raiz já é o instalador V8, `api.js` é V8, e os HTMLs promovidos na raiz (`MestreDoPC-Ultimate-v7.html`, etc.) são cópias dos `v*/index.html` que podem divergir.

---

## 2. Estrutura de Diretórios (Real e Detalhada)

```
MestreDoPC_V7_clone/
│
├── README.md                          → Docs do servidor MCP (foco em usuários finais)
├── CLAUDE.md                          → Guia técnico EXTENSO para Claude Code (contexto primário)
│
├── .claude/
│   ├── settings.json                  → Permissões: bash restrito a "git *" apenas
│   └── worktrees/analyze-85c27a/      → Worktree Git do Claude Code (cópia completa do repo)
│
├── mcp-server/                        → VERSÃO CANÔNICA V7 do MCP Server
│   ├── index.js                       → ~900 linhas, define ~30 tools + handlers Ollama
│   ├── package.json                   → Dependência única: @modelcontextprotocol/sdk ^1.27.1
│   ├── package-lock.json
│   └── README.md                      → Documentação específica do servidor
│
├── index.js (raiz)                    → ⚠️ CÓPIA LEGADA de mcp-server/index.js
├── package.json (raiz)                → ⚠️ CÓPIA LEGADA de mcp-server/package.json
├── package-lock.json (raiz)
│
├── api.js                             → Cliente HTTP V8 para o launcher (contrato /run, /run-status, /ping)
│   ├── Exporta funções: ping, runCommand, getStatus, waitForJob, runAndWait, bindJobToElement
│   └── Expõe global `window.MestreAPI` para HTML monolítico
│
├── design-tokens.css                  → Tokens CSS compartilhados (NÃO referenciado por nenhum HTML atual)
├── assets/
│   ├── api.js                         → ⚠️ CÓPIA DUPLICADA de api.js
│   └── design-tokens.css              → ⚠️ CÓPIA DUPLICADA de design-tokens.css
│
├── MestreDoPC-Ultimate-v7.html        → Interface Web V7 (~127KB, promovido da pasta v7/)
├── MestreDoPC-V8-Preview.html         → Interface Web V8 preview (~22KB, promovido de v8/)
├── MestreDoPC-V9-Designs.html         → Designs experimentais V9 (~38KB)
│
├── MestreDoPC-Launcher.ps1            → Launcher V7 monolítico (PowerShell, escuta porta 7777)
│
├── INSTALAR.bat                       → Bootstrap V7/V8: eleva Admin e executa install.ps1
├── install.ps1                        → ⚠️ INSTALADOR V8 na raiz! (instala Node, deps, tarefa agendada, config MCP)
├── Register-MestreTask.ps1            → Cria tarefa agendada "MestreDoPC_Admin_Launcher" como Admin oculto
├── start-mestre.bat                   → Verifica saúde do launcher (ping) e abre interface HTML
├── sync-mestre.ps1                    → Sincroniza com pasta externa (requer estrutura irmã fora do repo)
├── uninstall.ps1                      → Remove tarefa agendada, registros MCP, atalhos
├── uninstall.exe                      → Wrapper executável do uninstall.ps1
│
├── logs/
│   └── startup.log                    → Log de inicialização do launcher
│
├── startup/                           → ⚠️ PASTA VAZIA no momento (esperava conter scripts de startup)
│
├── v7/
│   ├── index.html                     → Interface web V7 original
│   ├── launcher.js                    → Launcher JS V7 (cliente HTTP)
│   ├── start-v7.bat                   → Iniciador específico V7
│   └── favicon.png / logo...
│
├── v8/
│   └── (iteração V8 paralela, autocontida — pouco explorada nesta revisão)
│
├── v8-refatorado/                     → VERSÃO MAIS EVOLUÍDA E DOCUMENTADA
│   ├── MestreDoPC-Launcher.ps1        → Entrypoint PowerShell V8 (param -Install, -Uninstall, -Port)
│   ├── README.md                      → Docs V8 (arquitetura, endpoints, variáveis de ambiente)
│   ├── docs/
│   │   ├── API.md                     → Referência completa da API REST (endpoints, request/response)
│   │   └── SECURITY.md                → Modelo de ameaças, mitigações, diferenças V7→V8
│   ├── mcp-server/
│   │   ├── index.js                   → MCP Server V8 (sanitização reforçada, retry, health check)
│   │   ├── package.json
│   │   └── package-lock.json
│   ├── scripts/
│   │   ├── install.ps1                → Instalador V8 (interno à pasta v8-refatorado)
│   │   ├── Register-MestreTask.ps1    → Registro de tarefa agendada V8
│   │   └── start-mestre.bat           → Iniciador V8
│   ├── src/
│   │   ├── config/
│   │   │   └── config.json            → Configuração central V8 (JSON)
│   │   ├── frontend/
│   │   │   ├── index.html             → SPA HTML V8
│   │   │   ├── css/style.css          → Estilos V8
│   │   │   └── js/app.js              → Aplicação JavaScript V8
│   │   ├── launcher/
│   │   │   ├── HttpServer.psm1        → Servidor HTTP PowerShell (CORS, rate limit, auth, routing)
│   │   │   ├── JobManager.psm1        → Gerenciador de jobs com RunspacePool (leve, reutilizável)
│   │   │   └── Logger.psm1            → Logging estruturado em JSON com rotação automática
│   │   ├── security/
│   │   │   └── SecurityConfig.psm1    → Allowlist de comandos + detecção de padrões perigosos
│   │   └── tests/
│   │       ├── E2E-Test.ps1           → Testes ponta-a-ponta
│   │       ├── SecurityAndJob.Tests.ps1 → Testes de segurança e jobs (estilo Pester)
│   │       ├── debug-server.ps1       → Debug do servidor
│   │       ├── manual-test.ps1        → Testes manuais
│   │       └── run-debug-server.ps1   → Script auxiliar de debug
│   ├── test-import.ps1                → Testes de importação de módulos
│   ├── test-minimal.ps1               → Teste mínimo do launcher
│   └── test-psscriptroot.ps1          → Teste de resolução de $PSScriptRoot
│
├── v9/
│   └── (iteração V9 paralela, autocontida — designs experimentais)
│
├── pwa-starter/
│   └── Scaffold PWABuilder (Lit + Vite + Workbox) — NÃO integrado ao resto do projeto
│
└── projeto-plano/
    └── README.md                      → Este documento
```

---

## 3. Arquitetura Técnica Detalhada

### 3.1 Visão Geral dos Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USUÁRIO / IA (Claude Desktop)                    │
└──────────────────┬────────────────────────────────────────────────────┘
                   │ MCP stdio (JSON-RPC)
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Server (Node.js)                                               │
│  V7: mcp-server/index.js  →  localhost:7777                         │
│  V8: v8-refatorado/mcp-server/index.js  →  localhost:18791         │
│                                                                     │
│  • Define ~30 ferramentas (tools)                                   │
│  • Sanitiza parâmetros (whitelist chars, max length, anti-injection)│
│  • Envia comandos via HTTP POST para o Launcher                     │
│  • Faz polling de status até conclusão                            │
│  • Comunica diretamente com Ollama (localhost:11434) para IA      │
└──────────────────┬────────────────────────────────────────────────────┘
                   │ HTTP POST /run  →  Polling /run-status
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Launcher PowerShell                                                │
│  V7: MestreDoPC-Launcher.ps1  →  Porta 7777                         │
│  V8: v8-refatorado/MestreDoPC-Launcher.ps1  →  Porta 18791         │
│                                                                     │
│  • Roda ELEVADO (Administrador)                                     │
│  • Escuta requisições HTTP localmente (127.0.0.1)                   │
│  • Executa comandos PowerShell reais no sistema                     │
│  • Retorna stdout/stderr/exitCode                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Segunda Interface: Navegador Web

A interface HTML (`MestreDoPC-Ultimate-v7.html`, `v8-refatorado/src/frontend/index.html`) usa `api.js` para se comunicar com o **mesmo** backend HTTP do launcher. É um cliente independente do MCP, compartilhando o mesmo contrato.

### 3.3 Integração Ollama (IA Local)

Três ferramentas MCP ignoram o launcher e falam diretamente com Ollama:

| Ferramenta | Função |
|---|---|
| `perguntar_ia` | Envia pergunta ao modelo local com system prompt especializado |
| `analisar_logs_sistema` | Coleta 20 erros do Event Viewer e pede resumo à IA |
| `verificar_modelo_ollama` | Checa se modelo está instalado; solicita download se não estiver |

**Modelos configurados:**
- **V7 MCP**: `qwen2.5-coder:1.5b`
- **V8 MCP (fallback)**: `qwen2.5:1.5b`
- **V8 Launcher config.json**: `qwen3.5:cloud` (pode indicar migração planejada ou inconsistência)

---

## 4. Comparação V7 vs V8

| Aspecto | V7 | V8 Refatorado |
|---|---|---|
| **Porta padrão** | `7777` | `18791` (configurável) |
| **Launcher** | Script monolítico `MestreDoPC-Launcher.ps1` | Entrypoint + 3 módulos PowerShell (`HttpServer`, `JobManager`, `Logger`) + `SecurityConfig` |
| **Execução de comandos** | `Invoke-Expression` (arbitrário) | `Invoke-Command` com `scriptblock` + allowlist de comandos |
| **Job Engine** | `Start-Job` (processo separado, pesado) | `RunspacePool` (1-5 runspaces, leve, reutilizável) |
| **CORS** | `*` (qualquer origem) | Origens configuradas: `localhost`, `127.0.0.1`, `file://` |
| **Autenticação** | Nenhuma | Bearer token opcional (desativado por padrão) |
| **Rate Limiting** | Não existe | 30 req/min por IP |
| **Sanitização de Input** | Regex simples: `[^a-zA-Z0-9\-_. ]` | Múltiplas camadas: max length, remoção de controles, bloqueio de padrões perigosos, escape de aspas |
| **Logging** | Nenhum | JSON estruturado com rotação automática (30 dias) |
| **Configuração** | Hardcoded | `src/config/config.json` centralizado |
| **Documentação Técnica** | `CLAUDE.md` (geral) | `docs/API.md` + `docs/SECURITY.md` + `README.md` específicos |
| **Testes** | Nenhum | Pester (`SecurityAndJob.Tests.ps1`), E2E, debug scripts |
| **PowerShell requerido** | 5.1+ | 7.4+ (recomendado) |

---

## 5. Catálogo Completo de Ferramentas MCP (~30+)

As ferramentas são definidas no objeto `mestreTools` em `mcp-server/index.js` (ou `v8-refatorado/mcp-server/index.js`). Placeholders `{{TOKEN}}` são varridos automaticamente para gerar o JSON Schema de entrada.

### 5.1 Limpeza do Sistema (5 tools)
| Nome | Descrição |
|---|---|
| `limpeza_rapida_completa` | Limpa TEMP do usuário e do Windows, esvazia lixeira |
| `esvaziar_lixeira` | Esvazia a lixeira silenciosamente |
| `limpar_cache_windows_update` | Para wuauserv, limpa `SoftwareDistribution\Download`, reinicia serviço |
| `limpar_logs_event_viewer` | Limpa todos os logs do Event Viewer |
| `limpar_cache_thumbnail` | Limpa cache de miniaturas do Explorer |

### 5.2 Memória / RAM (3 tools)
| Nome | Descrição |
|---|---|
| `liberar_memoria_ram` | Força Garbage Collector do .NET |
| `ver_uso_ram` | Mostra RAM livre e total via WMI |
| `listar_processos_alto_consumo_ram` | Top 15 processos por WorkingSet |

### 5.3 Processos e Serviços (3 tools)
| Nome | Parâmetro | Descrição |
|---|---|---|
| `reiniciar_explorer` | — | Mata e reinicia explorer.exe |
| `encerrar_processo` | `{{NOME}}` | Para processo pelo nome |
| `desativar_servico` | `{{NOME_SERVICO}}` | Para e desabilita serviço |

### 5.4 Disco (2 tools)
| Nome | Descrição |
|---|---|
| `verificar_espaco_disco` | Espaço usado/livre/total por drive |
| `verificar_saude_disco` | Status S.M.A.R.T. via WMI |

### 5.5 Rede (2 tools)
| Nome | Descrição |
|---|---|
| `diagnostico_rede` | `ipconfig /all` completo |
| `renovar_ip` | Flush DNS, release, renew |

### 5.6 Reparo do Sistema (2 tools)
| Nome | Descrição |
|---|---|
| `reparar_arquivos_sfc` | `sfc /scannow` |
| `reparar_imagem_dism` | `DISM /Online /Cleanup-Image /RestoreHealth` |

### 5.7 Diagnóstico e Relatórios (5 tools)
| Nome | Descrição |
|---|---|
| `verificar_informacoes_sistema` | WindowsProductName, versão, arquitetura, CPU, RAM |
| `verificar_temperatura_cpu` | Temperatura ACPI via WMI |
| `diagnostico_completo` | RAM + disco + processos + internet em um comando |
| `relatorio_rapido_pc` | Relatório formatado com uptime, specs, top processos |
| `exportar_diagnostico` | Salva diagnóstico em `logs/diagnostico-YYYYMMDD-HHMMSS.txt` |

### 5.8 Ollama / IA Local (2 tools)
| Nome | Descrição |
|---|---|
| `listar_modelos_ollama` | Lista modelos instalados; destaca os com "cloud" no nome |
| `testar_ollama` | Testa modelo `glm-5.2:cloud` com prompt simples |

### 5.9 Utilitários (2 tools)
| Nome | Descrição |
|---|---|
| `abrir_pasta_logs` | Abre pasta `logs/` no Windows Explorer |
| `ver_tarefas_mestre` | Lista tarefas agendadas `MestreDoPC_Admin_Launcher` e `MestreDoPC_Startup` |

### 5.10 Git / Projeto (2 tools)
| Nome | Descrição |
|---|---|
| `git_status` | `git status` na pasta definida por `MESTRE_PROJETO_PATH` |
| `git_pull` | `git pull` na pasta do projeto |

### 5.11 Segurança (2 tools)
| Nome | Descrição |
|---|---|
| `verificar_defender` | Status do Windows Defender (modo, assinatura, RTP) |
| `scan_defender_rapido` | Inicia `QuickScan` no Defender |

### 5.12 Ferramentas de IA do MCP Server (3 tools — handlers dedicados)
| Nome | Descrição |
|---|---|
| `perguntar_ia` | Envia pergunta ao Ollama com system prompt "Mestre do PC" |
| `analisar_logs_sistema` | Coleta 20 erros do Event Viewer e pede análise à IA |
| `verificar_modelo_ollama` | Verifica/Download do modelo configurado |

**Total: 32 ferramentas MCP registradas.**

---

## 6. Configuração do V8 (`v8-refatorado/src/config/config.json`)

Arquivo de configuração central real encontrado no repositório:

```json
{
    "port": 18791,
    "host": "127.0.0.1",
    "useHttps": false,
    "jobTimeoutMs": 900000,
    "jobRetentionMinutes": 30,
    "maxConcurrentJobs": 5,
    "rateLimitPerMinute": 30,
    "allowedOrigins": ["http://localhost", "http://127.0.0.1", "file://"],
    "logLevel": "INFO",
    "logRetentionDays": 30,
    "mcp": {
        "enabled": true,
        "projectPath": "C:\\Users\\Jeanc\\MestreDoPC_V7"
    },
    "ollama": {
        "url": "http://localhost:11434",
        "model": "qwen3.5:cloud",
        "timeoutMs": 15000,
        "fallbackEnabled": true
    },
    "apiAuth": {
        "enabled": false,
        "tokens": []
    },
    "security": {
        "requireApiToken": false,
        "sanitizeInputs": true,
        "commandAllowlist": true,
        "enableCors": true,
        "executionPolicy": "RemoteSigned"
    },
    "features": {
        "darkMode": true,
        "mcpIntegration": true,
        "ollamaAI": true,
        "electronApp": false,
        "autoUpdate": false
    }
}
```

---

## 7. Módulos PowerShell do V8 (Detalhamento)

### 7.1 `Logger.psm1`
- Níveis: `INFO`, `WARN`, `ERROR`, `AUDIT`, `DEBUG`
- Formato: JSON com `timestamp`, `level`, `source`, `message`, `pid`, `metadata`
- Console: saída colorida
- Arquivo: `logs/launcher-YYYYMM.log`
- Rotação: arquivos com mais de 30 dias são removidos automaticamente

### 7.2 `JobManager.psm1`
- `Initialize-JobManager`: Cria `RunspacePool` com 1-5 runspaces
- `New-CommandJob`: Enfileira comando com GUID único, timeout configurável (padrão 900s)
- `Get-CommandJob`: Consulta status de job por ID
- Execução via `Invoke-Command -ScriptBlock` (mais seguro que `Invoke-Expression`)
- Logs truncados do comando (primeiros 100 caracteres) para auditoria

### 7.3 `HttpServer.psm1`
- `Start-MpcServer`: Inicializa listener HTTP, carrega config, módulos e entra no loop
- `Process-MpcRequest`: Pipeline por requisição:
  1. CORS Headers (valida `Origin` contra lista permitida)
  2. Preflight `OPTIONS` → 204
  3. Rate Limiting (`Test-RateLimit` por IP)
  4. Auth Token (se `apiAuth.enabled`)
  5. Routing (`/api/health`, `/api/status`, `/api/command`, `/api/jobs/{id}`, `/run`, `/run-status`)

### 7.4 `SecurityConfig.psm1`
- `Get-AllowedCommands`: Lista explícita de ~25 comandos/apletos PowerShell permitidos (ex: `Get-Process`, `Stop-Process`, `Remove-Item`, `sfc`, `DISM`, `git`, `[System.GC]::Collect`, `ipconfig`, `defrag`, `Optimize-Volume`)
- `Get-DangerousPatterns`: Regex de bloqueio para:
  - `Invoke-Expression`, `IEX`
  - `Invoke-WebRequest -OutFile`, `Start-BitsTransfer`, `New-Object Net.WebClient`
  - `DownloadString`, `DownloadFile`, `FromBase64String`, `EncodedCommand`
  - `net user`, `net localgroup`, `reg delete`, `format `, `del /[fq]`, `rd /[sq]`
  - Bypass de execution policy, janelas ocultas
- `Test-CommandSafety`: Retorna score e categoria (`safe`, `suspicious`, `dangerous`, `not_allowed`)

---

## 8. Fluxos de Instalação e Operação

### Instalação Completa (V8)
```
INSTALAR.bat (como Admin)
    └─► install.ps1
        ├─► 0. Auto-eleva se não for Admin
        ├─► 1. Valida arquivos obrigatórios
        ├─► 2. Instala Node.js via winget (se ausente)
        ├─► 3. npm install em mcp-server/
        ├─► 4. Register-MestreTask.ps1 (tarefa agendada oculta como Admin)
        ├─► 5. Registra MCP em %APPDATA%\Claude\claude_desktop_config.json
        ├─► 6. Cria atalhos (Desktop, Menu Iniciar)
        └─► 7. Validação final
```

### Execução Diária
```
start-mestre.bat
    ├─► Checa tarefa agendada
    ├─► Testa 127.0.0.1:7777/ping (V7) ou :18791 (V8)
    └─► Abre interface HTML no navegador padrão
```

### Execução via IA (Claude Desktop)
```
Claude inicia mcp-server/index.js via stdio
    ├─► Usuário pede: "Faça uma limpeza rápida"
    ├─► Claude chama tool: limpeza_rapida_completa
    ├─► MCP Server sanitiza e envia POST /run
    ├─► Launcher executa PowerShell elevado
    └─► MCP Server faz polling /run-status até "done"
```

---

## 9. Débitos Técnicos e Inconsistências Identificadas

### 🔴 Críticos
1. **Contaminação da raiz**: `install.ps1`, `api.js` e possivelmente outros scripts na raiz já são V8, não V7. Isso pode confundir desenvolvedores e ferramentas de CI.
2. **Inconsistência de modelo Ollama**: V8 `config.json` aponta `qwen3.5:cloud`, mas o MCP server V8 usa `qwen2.5:1.5b`. O V7 usa `qwen2.5-coder:1.5b`.
3. **Duplicação de código**: `index.js` e `package.json` na raiz espelham `mcp-server/`. Mudanças precisam ser replicadas manualmente.

### 🟡 Médios
4. **Assets órfãos**: `design-tokens.css` e `assets/` não são referenciados por nenhum HTML carregado.
5. **PWA isolada**: `pwa-starter/` existe como scaffold sem relação com o resto. Deve ser integrada ou removida.
6. **Pasta `startup/` vazia**: Esperava-se scripts de inicialização, mas está vazia no momento.
7. **Testes na raiz**: `npm test` é um stub. Não há testes automatizados para o MCP server V7.

### 🟢 Baixos
8. **HTMLs promovidos na raiz**: Podem divergir das versões dentro de `v7/`, `v8/`, `v9/`.
9. **Documentação duplicada**: `README.md` (raiz) e `mcp-server/README.md` têm conteúdo similar.
10. **Worktree do Claude**: `.claude/worktrees/analyze-85c27a/` é uma cópia completa do repo; ocupa espaço desnecessário após análise.

---

## 10. Roadmap e Próximos Passos Recomendados

### Fase 1: Consolidação (Semanas 1-2)
- [ ] **Definir a raiz como V8 oficial**: Mover arquivos V7 legados para `v7/legacy/` ou apagar cópias duplicadas.
- [ ] **Eliminar duplicação**: Apagar `index.js` e `package.json` da raiz; criar symlink ou script de sync se necessário.
- [ ] **Unificar modelo Ollama**: Decidir entre `qwen2.5:1.5b`, `qwen3.5:cloud` ou tornar configurável via env var única.
- [ ] **Ativar testes**: Implementar `npm test` no MCP server (Jest ou Vitest).

### Fase 2: Qualidade e Segurança (Semanas 3-4)
- [ ] **Integrar PWA**: Mover `pwa-starter/` para `v8-refatorado/src/frontend/pwa/` e integrar ao build.
- [ ] **Testes automatizados**: Expandir `SecurityAndJob.Tests.ps1` para cobrir todas as 32 tools.
- [ ] **CI/CD**: GitHub Actions para validar instalação em Windows runner (GitHub hospeda runners Windows).
- [ ] **Health check aprimorado**: Endpoint `/api/health` já existe no V8; adicionar checagem de dependências (Node, Ollama, Admin).

### Fase 3: Evolução (Mês 2+)
- [ ] **Electron wrapper**: `features.electronApp: false` no config.json. Implementar wrapper Electron para distribuição como app desktop.
- [ ] **Auto-update**: Implementar mecanismo de atualização automática (check de release no GitHub).
- [ ] **Extensão VS Code**: Portar ferramentas MCP para funcionar também no Continue.dev/Copilot.
- [ ] **Telemetria anônima**: Entender quais tools são mais usadas para priorizar desenvolvimento.
- [ ] **Suporte a múltiplos idiomas**: Estrutura i18n para inglês/espanhol.

---

## 11. Ambiente de Desenvolvimento

### Requisitos
| Componente | Versão Mínima |
|---|---|
| Windows | 10/11 |
| PowerShell | 5.1 (V7) / 7.4+ (V8 recomendado) |
| Node.js | 18 LTS |
| Ollama | Opcional (para ferramentas de IA) |

### Para desenvolver no MCP Server (V7 canônico)
```bash
cd mcp-server
npm install
npm start        # Roda via stdio (normalmente iniciado pelo Claude Desktop)
```

### Para desenvolver no V8 Refatorado
```powershell
# 1. Instalar como Admin
.\v8-refatorado\MestreDoPC-Launcher.ps1 -Install

# 2. Rodar o launcher (elevação recomendada)
.\v8-refatorado\MestreDoPC-Launcher.ps1

# 3. Em outro terminal, rodar o MCP Server V8
cd v8-refatorado\mcp-server
npm install
$env:MESTRE_BASE_URL="http://localhost:18791"
npm start
```

### Variáveis de Ambiente
| Variável | Padrão (V7) | Padrão (V8) | Descrição |
|---|---|---|---|
| `MESTRE_BASE_URL` | `http://localhost:7777` | `http://localhost:18791` | URL do Launcher |
| `MESTRE_PROJETO_PATH` | `C:\MestreDoPC_V7` | `C:\MestreDoPC_V8` | Pasta para comandos git |
| `OLLAMA_URL` | `http://localhost:11434` | `http://localhost:11434` | Endpoint Ollama |
| `OLLAMA_MODEL` | `qwen2.5-coder:1.5b` | `qwen2.5:1.5b` | Modelo padrão |

---

## 12. Licença, Autoria e Notas Finais

- **Autor**: Jeanc
- **Licença**: ISC
- **Idioma**: Português (Brasil) — interface e documentação
- **Plataforma**: Windows exclusivo (PowerShell + WMI + DISM)
- **Público-alvo**: Usuários finais brasileiros, administradores de TI, entusiastas de automação

> **Aviso de segurança**: Este software executa comandos com privilégios de Administrador. Embora possua múltiplas camadas de proteção (allowlist, sanitização, rate limiting), o uso incorreto ou a modificação não autorizada dos scripts pode comprometer o sistema. Sempre execute em ambiente controlado e mantenha backups.

---

> **Versão deste plano**: 2.0 (Revisão Completa)  
> **Data da revisão**: 2025-07-25  
> **Revisado por**: Claude (Pi Coding Agent)  
> **Baseado em**: Análise direta de ~20 arquivos-fonte do repositório
