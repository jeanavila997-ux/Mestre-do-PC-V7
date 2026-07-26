# Revisão Completa do Contexto — Mestre do PC V10

> **Data da revisão:** 2025-07-26  
> **Repositório:** `jeanavila997-ux/Mestre-do-PC-V7`  
> **Branch/Worktree atual:** `claude/superpowers-receiving-code-review-e65c25`  
> **Último commit:** `827db16` — `feat: integra MCP mestre-do-pc ao Codex CLI`  
> **Autor da revisão:** Claude Code (Pi Coding Agent)

---

## 1. Visão Geral

**Mestre do PC V10** é um aplicativo Windows de diagnóstico e manutenção que combina:

- Interface web monolítica (`v10/index.html`) servida em `http://127.0.0.1:7777/`
- Backend administrativo elevado em PowerShell (`MestreDoPC-Launcher.ps1`) ou alternativa Node.js (`v10/launcher.js`)
- Servidor MCP (Model Context Protocol) em Node.js (`mcp-server/index.js`) comunicando por `stdio`
- IA local via Ollama em `http://127.0.0.1:11434`
- Integração com Claude Desktop, Claude Code e Codex CLI

A plataforma expõe **186 comandos PowerShell** organizados em **19 categorias**, além de **33 ferramentas MCP** para uso por assistentes de IA.

---

## 2. Estrutura do Repositório

```text
MestreDoPC_V7_clone/
├── v10/                         ← VERSÃO ATIVA
│   ├── index.html               (1244 linhas, interface web)
│   ├── launcher.js              (alternativa Node ao launcher PS)
│   ├── start-v10.bat            (bootstrap sem UAC)
│   └── package.json
├── mcp-server/                  ← Servidor MCP (33 tools)
│   ├── index.js
│   ├── security.js              (sanitização de argumentos)
│   ├── package.json
│   └── test/                    (testes Node nativos)
├── MestreDoPC-Launcher.ps1      ← Launcher PowerShell principal (porta 7777)
├── Register-MestreTask.ps1      ← Registra tarefa agendada admin
├── install.ps1                  ← Instalador Windows
├── INSTALAR.bat                 ← Wrapper com elevação UAC
├── uninstall.ps1 / uninstall.exe
├── startup/                     ← Scripts de inicialização (Ollama warm-up)
├── docs/                        ← Documentação do projeto
├── projeto-plano/               ← Planos e análises históricas
├── legado/                      ← Versões antigas (NÃO alterar)
├── .claude/                     ← Configurações do Claude Code
├── .codex/                      ← Configurações do Codex CLI
├── .agents/skills/              ← Skills para Claude e Codex
├── .vscode/                     ← Recomendações de extensões
├── CLAUDE.md                    ← Instruções técnicas para Claude Code
└── README.md
```

---

## 3. Arquitetura e Componentes

### 3.1 Interface Web (`v10/index.html`)

- HTML/CSS/JS monolítico, sem frameworks
- 19 categorias, 186 comandos PowerShell
- Tema claro/escuro, favoritos, fila de execução, dashboard de métricas
- Terminal ao vivo com output em tempo real
- Chat IA local com streaming via Ollama proxy
- Persistência em `localStorage` (favoritos, histórico, tema)

**Novidades V10:**
- Dashboard de CPU, RAM, disco e uptime (`/status`)
- Sistema de favoritos e fila de comandos
- Tema claro/escuro
- Terminal modal ao vivo
- Atalhos de teclado (`Ctrl+K`, `Ctrl+/`, `Esc`)
- Confirmação para comandos destrutivos e comandos sugeridos pela IA

### 3.2 Launcher PowerShell (`MestreDoPC-Launcher.ps1`)

- Servidor HTTP em `127.0.0.1:7777`
- Auto-elevação via UAC (`RunAs`)
- Jobs PowerShell assíncronos com timeout de 15 minutos
- Máximo de 3 jobs simultâneos
- Cleanup automático de jobs concluídos após 30 minutos
- Proteção de origem: `X-Mestre-Client` e validação de `Origin`

**Endpoints:**
| Endpoint | Método | Função |
|----------|--------|--------|
| `/` | GET | Serve `v10/index.html` |
| `/ping` | GET | Health check |
| `/status` | GET | Métricas do sistema |
| `/run` | POST | Agenda comando PowerShell |
| `/run-status` | GET | Consulta status de job |
| `/open-terminal` | POST | Abre PowerShell elevado |
| `/mcp-status` | GET | Detecta MCP via WMI |
| `/ollama/tags` | GET | Proxy para modelos Ollama |
| `/ollama/chat` | POST | Proxy streaming NDJSON |

### 3.3 Launcher Node.js (`v10/launcher.js`)

- Alternativa multiplataforma ao launcher PowerShell
- Usa `node:http` + `child_process.spawn`
- Mesma origem e validação de cliente (`X-Mestre-Client`)
- Útil para Linux/macOS (sem PowerShell) e desenvolvimento

### 3.4 MCP Server (`mcp-server/index.js`)

- SDK: `@modelcontextprotocol/sdk ^1.29.0`
- Transporte: `stdio` (`StdioServerTransport`)
- 33 ferramentas registradas:
  - 30 ferramentas mapeadas de `mestreTools`
  - 3 ferramentas dedicadas: `perguntar_ia`, `analisar_logs_sistema`, `verificar_modelo_ollama`

**Categorias MCP:**
- Limpeza geral e avançada
- Memória / RAM
- Processos e serviços
- Disco
- Rede
- Reparo do sistema
- Diagnóstico e relatórios
- Ollama / IA local
- Utilitários
- Git / projeto
- Segurança / Defender

### 3.5 Ollama / IA Local

- Endpoint padrão: `http://127.0.0.1:11434`
- Modelo padrão: `qwen2.5-coder:1.5b` (local, ~1 GB)
- Modelos cloud detectados: `glm-5.2:cloud`, `minimax-m3:cloud`, `kimi-k2.5:cloud`, `gemma4:cloud`, `glm-5.1:cloud`
- Requer `ollama signin` para modelos cloud
- Streaming via `/ollama/chat`
- Preload + `keep_alive: 10m` para resposta instantânea

### 3.6 Instalação e Ativação

- `INSTALAR.bat` → `install.ps1` (com elevação UAC)
- Instala Node.js (se ausente), dependências do MCP
- Registra tarefas agendadas:
  - `MestreDoPC_Admin_Launcher` (AtLogon, Admin)
  - `MestreDoPC_Startup` (AtLogon, usuário — Ollama warm-up)
- Registra MCP no Claude Code (`~/.claude.json`) e Claude Desktop (`claude_desktop_config.json`)
- Cria atalhos na Área de Trabalho e Menu Iniciar

---

## 4. Fluxo de Execução

### 4.1 Uso Diário (Interface Web)

1. Usuário clica no atalho **"Mestre do PC"**
2. `v10\start-v10.bat` faz health-check em `/ping`
3. Se offline, dispara `MestreDoPC_Admin_Launcher` via `schtasks`
4. Abre `http://127.0.0.1:7777/` no navegador
5. Frontend envia comandos via `POST /run` com `X-Mestre-Client: v10-web`
6. Launcher executa em job elevado; frontend consulta `/run-status`

### 4.2 Uso via IA (Claude Desktop / Claude Code / Codex)

1. Assistente inicia `mcp-server/index.js` via stdio
2. Usuário solicita ação (ex: "faça uma limpeza rápida")
3. Assistente chama tool MCP (`limpeza_rapida_completa`)
4. MCP sanitiza argumentos e envia `POST /run` com `X-Mestre-Client: mcp`
5. Launcher executa; MCP faz polling em `/run-status`
6. Resultado retornado ao assistente

### 4.3 Codex CLI

- `.codex/config.toml` registra o MCP `mestre-do-pc`
- Último commit (`827db16`) integra o MCP mestre-do-pc ao Codex CLI
- Multi-agent habilitado com papéis: explorer, reviewer, docs_researcher

---

## 5. Segurança

### 5.1 Camadas de Proteção

- **Bind restrito:** `127.0.0.1` apenas
- **Validação de origem:** `BASE_URL` e `Origin` nos endpoints POST
- **Cabeçalho obrigatório:** `X-Mestre-Client: v10-web` ou `mcp`
- **Sanitização de argumentos:** `security.js` rejeita metacaracteres PowerShell
- **Confirmação de comandos destrutivos:** modal `confirm()` no frontend
- **Confirmação de comandos da IA:** toda ação sugerida por LLM requer aprovação
- **Sem CORS `*`:** apenas origens autorizadas
- **Limite de jobs:** máximo 3 simultâneos
- **Timeout:** 15 minutos por job

### 5.2 Regras do Projeto (CLAUDE.md)

- Preserve a separação entre MCP não elevado e launcher elevado
- Nunca adicione entrada do usuário diretamente a PowerShell
- Comandos destrutivos e sugeridos pela IA exigem confirmação
- Use `MESTRE_PROJETO_PATH`; não grave caminhos pessoais no HTML
- Adicione/atualize testes em `mcp-server/test/`
- Use commits convencionais (`fix:`, `feat:`, `docs:`, `chore:`)

---

## 6. Testes e Validação

### 6.1 Testes Node.js (`mcp-server/test/`)

| Arquivo | Cobertura |
|---------|-----------|
| `security.test.js` | Sanitização de argumentos (caracteres seguros vs metacaracteres) |
| `launcher-security.test.js` | Launcher Node: PORT/MPC_PORT, POST externo bloqueado, CORS, preflight |
| `project-smoke.test.js` | V10 HTML: compilação do script inline, uso de `MESTRE_PROJETO_PATH`, cabeçalho privilegiado |

### 6.2 Comandos de Desenvolvimento

```powershell
cd mcp-server
npm ci
npm test
node --check index.js
node --check ..\v10\launcher.js
```

Validação de scripts PowerShell via parser do `System.Management.Automation.Language.Parser`.

---

## 7. Configurações Claude Code / Codex

### 7.1 Skills

- `.agents/skills/Mestre-do-PC-V7/SKILL.md` → skill para Codex
- `.claude/skills/Mestre-do-PC-V7/SKILL.md` → skill para Claude Code

Ambos definem:
- Arquitetura canônica
- Regras de segurança obrigatórias
- Validação via `npm test`, `node --check` e testes do launcher

### 7.2 Identidade (`.claude/identity.json`)

- Nível técnico: `technical`
- Estilo: verbose, comentários em código, explicações
- Domínios: JavaScript, PowerShell, MCP, Ollama

### 7.3 Codex (`.codex/config.toml`)

- Approval policy: `on-request`
- Sandbox mode: `workspace-write`
- Web search: `live`
- MCPs registrados:
  - `mestre-do-pc` (próprio projeto)
  - `context7`, `exa`, `memory`, `playwright`, `sequential-thinking`
- Multi-agent com explorer, reviewer e docs_researcher

### 7.4 ECC Tools (`.claude/ecc-tools.json`)

- Perfil: `core`
- Tier: `free`
- Arquivos gerenciados incluem skills, identity, config Codex e instincts
- Readiness score: 0/7 (faltam reference sets para análise profunda)

---

## 8. Documentação

| Documento | Conteúdo |
|-------------|----------|
| `README.md` | Visão geral, instalação, arquitetura |
| `CLAUDE.md` | Regras técnicas para Claude Code |
| `docs/INSTALACAO-CLIENTE.md` | Guia completo de instalação (Win/Linux/macOS) |
| `docs/RAG.md` | Guia opcional de RAG com Azure AI Search |
| `docs/deployment.md` | Deploy com Azure Developer CLI (`azd`) |
| `docs/deploy_customization.md` | Customização de recursos e modelos Azure |
| `docs/microsoft_integration_plan.md` | Plano de integração Entra/Graph/Teams |
| `docs/multi_llm_integration.md` | Proposta OpenAI Agents SDK |
| `projeto-plano/revisao-completa-v10.md` | Revisão anterior detalhada da V10 |
| `projeto-plano/extracao-versoes/v10-padrao-e-novas-funcoes.md` | Padrão V7 + novas funções V10 |

---

## 9. Pontos Fortes

- ✅ Arquitetura limpa e coesa após reorganização
- ✅ Interface rica e responsiva (tema, favoritos, fila, dashboard, terminal ao vivo)
- ✅ Launcher PowerShell resiliente (auto-elevação, health-check, cleanup, streaming Ollama)
- ✅ Segurança bem pensada (validação de origem, cabeçalho cliente, sanitização, confirmações)
- ✅ Modelo Ollama local como padrão (sem necessidade de login)
- ✅ MCP funcional para Claude Desktop, Claude Code e Codex CLI
- ✅ Documentação abrangente (`docs/INSTALACAO-CLIENTE.md`)
- ✅ Testes de segurança para o launcher Node e sanitização
- ✅ Alternativa multiplataforma com `v10/launcher.js`

---

## 10. Observações e Melhorias Recomendadas

### 10.1 Itens de Baixo Risco

1. **Dead code no HTML:** `OLLAMA_URL` declarado mas não usado (`v10/index.html`)
2. **Descrição MCP:** menciona `qwen2.5:1.5b` em vez de `qwen2.5-coder:1.5b`
3. **CSP no HTML:** adicionar `Content-Security-Policy` via meta tag para camada extra
4. **Metadados V10:** `v10/package.json` pode ter `description`/`author`
5. **README raiz:** atualizar para refletir V10 como versão ativa

### 10.2 Itens de Médio Valor

1. **Testes automatizados expandidos:** cobrir todos os endpoints do launcher PS/Node
2. **CI/CD:** GitHub Actions para lint PS + Node + Markdown
3. **PWA:** manifest + service worker para instalação como app
4. **Log estruturado:** rotação e categorização de logs
5. **Modo somente leitura:** preview de comandos sem executar

### 10.3 Nenhum Problema Crítico Identificado

O projeto está **funcional e seguro para uso pessoal/local**. A arquitetura separa corretamente os privilégios e as responsabilidades.

---

## 11. Contexto Adicional Informado pelo Usuário

O usuário mencionou a pasta:

```text
C:\Users\Jeanc\projects\agentes claude code
```

**Status verificado:** pasta existe, mas está **vazia** (`total 4`, apenas `.` e `..`).  
Portanto, não há contexto adicional a ser incorporado deste caminho nesta revisão.

---

## 12. Conclusão

O **Mestre do PC V10** é um projeto maduro, bem documentado e com arquitetura adequada para manutenção Windows assistida por IA. A integração com Claude Code, Claude Desktop e Codex CLI está ativa e funcional. As práticas de segurança (validação de origem, sanitização, confirmações) estão implementadas. A documentação cobre instalação, operação e evolução futura.

**Próximos passos sugeridos:**
1. Limpar dead code e corrigir descrição do modelo MCP
2. Expandir cobertura de testes automatizados
3. Atualizar README raiz para refletir a V10
4. Avaliar CI/CD com GitHub Actions
5. Considerar PWA para distribuição mais ampla

---

*Documento gerado automaticamente pela revisão de contexto do Claude Code.*
