# Mestre do PC V10 — Padrão de Código V7 + Novas Funções

> A V10 foi construída seguindo **exatamente o padrão de código da V7**,
> apenas **adicionando** novas categorias, novos comandos e novas funções JS.
> Nenhuma função da V7 foi removida ou alterada — todas foram preservadas
> com as mesmas assinaturas e contratos de API.

---

## 1. Padrão de Código Identificado na V7

### Estrutura do arquivo
- **HTML monolítico** único: `<!doctype html>` + `<head>` (meta + `<style>`) + `<body>` + `<script>`.
- **Sem dependências externas** (sem frameworks, sem build, sem imports).
- **CSS com variáveis** em `:root`: `--bg`, `--panel`, `--accent`, `--accent2`, `--text`, `--border`, `--card`, `--danger`, `--success`.
- **Layout sidebar + main**: sidebar fixa com logo + navegação; main com header + conteúdo.

### Padrão de dados — `CATS`
```js
const CATS = [
  { id: "cat1", label: "1. Limpeza Geral", cmds: [
    ["Título do Comando", "comando PowerShell cru"],
    ...
  ]},
  ...
];
```
- Cada categoria: `{id, label, cmds}`.
- Cada comando: par `[título, string PowerShell]`.
- Tokens `NOME_DO_PROCESSO`, `NOME_SERVICO` em comandos são detectados via `PARAM_PATTERNS` para pedir input ao usuário.

### Padrão de renderização
- **Navegação** gerada via `CATS.forEach` → `<a class="nav-item">` com `onclick` (smooth scroll).
- **Categorias** geradas via `CATS.forEach` → `<div class="category">` com header (toggle) + grid de cards.
- **Cards** via template literal `innerHTML` com UID `${c.id}_${i}` para cada `<code>`.
- **Botões inline**: `onclick="copyById('uid')"` e `onclick="runCmd('uid')"`.

### Padrão de funções JS (V7 — 21 funções)
| Função | Responsabilidade |
|---|---|
| `toggleCat(header)` | expande/colapsa categoria |
| `cancelParam()` / `confirmParam()` | modal de parâmetro |
| `showToast(msg, color)` | notificação temporária |
| `checkServer()` | health-check do launcher (`/ping` + `/mcp-status` + Ollama) |
| `sleep(ms)` | utilitário de espera |
| `dispatchCommand(code, options)` | POST `/run` + polling `/run-status` |
| `copyById(uid)` | copia para clipboard |
| `runCmd(uid)` | verifica params, copia fallback, executa |
| `executeCmd(code)` | painel de output + dispatch + resultado |
| `openPS()` | abre terminal admin via `/open-terminal` |
| `chooseOllamaModel(models)` | seleciona modelo preferido |
| `openAI()` / `closeIA()` | modal de chat IA |
| `checkOllama()` | lista modelos |
| `sendIA()` | streaming chat Ollama |
| `addIAMessage(text, role)` | adiciona mensagem |
| `renderIAContent(el, text)` | markdown + botão executar |
| `runIACmd(btn)` | executa comando sugerido pela IA |
| `scrollIAToBottom()` | scroll do chat |
| `showOutput(text)` | painel de output |

### Padrão de API (Launcher porta 7777)
- `GET /ping` → `{status, state, activeJobs, admin}`
- `POST /run` `{cmd}` → `{success, accepted, jobId}`
- `GET /run-status?id=` → `{state, success, output, exitCode, activeJobs}`
- `POST /open-terminal` → abre PowerShell admin
- `GET /mcp-status` → status do MCP
- Ollama: `http://localhost:11434/api/tags` e `/api/chat` (streaming NDJSON)

### Padrão de boot
```js
checkServer();
setInterval(checkServer, 10000);
// + IntersectionObserver para highlight do nav
// + listener de busca em tempo real no searchInput
```

---

## 2. V10 — O que foi ADICIONADO (sem alterar o padrão V7)

### Novas categorias de comandos (5 categorias, 44 comandos novos)

| Categoria | ID | Comandos | Foco |
|---|---|---|---|
| 14. Performance & Jogos | `cat14` | 10 | Game Mode, planos de energia, efeitos visuais, cache GPU |
| 15. Backup & Restauração | `cat15` | 8 | Pontos de restauração, backup drivers/registro/apps/hosts |
| 16. Atualizações Avançadas | `cat16` | 8 | Pausar/retomar WU, histórico, reset de componentes |
| 17. Drivers | `cat17` | 8 | Listar, exportar, atualizar, backup de drivers |
| 18. Privacidade & Telemetria | `cat18` | 10 | Telemetria, ID publicidade, Cortana, localização |

**Total V10:** 14 categorias V7 (142 comandos) + 5 categorias novas (44 comandos) = **19 categorias, 186 comandos**.

### Novos padrões em `PARAM_PATTERNS` (tokens de parâmetro)
- `NUMERO_KB` — para desinstalar atualização específica
- `CAMINHO.inf` — para instalar driver via pnputil

### Novas funções JS (17 funções adicionadas → total 38)

| Função | Categoria | Descrição |
|---|---|---|
| `toggleTheme()` | UI | Alterna tema claro/escuro (persiste em `localStorage`) |
| `toggleFavorite(uid, el)` | Favoritos | Marca/desmarca comando como favorito (estrela no card) |
| `renderFavorites()` | Favoritos | Renderiza barra de chips de favoritos |
| `removeFav(uid)` | Favoritos | Remove favorito |
| `addToQueue(uid)` | Fila | Adiciona comando à fila de execução |
| `renderQueue()` | Fila | Renderiza painel de fila |
| `removeFromQueue(i)` | Fila | Remove item da fila |
| `clearQueue()` | Fila | Limpa fila |
| `runQueue()` | Fila | Executa comandos da fila em sequência |
| `exportHistory()` | Histórico | Exporta histórico de comandos em JSON |
| `openTerminalModal(title)` | Terminal | Abre modal de terminal ao vivo |
| `closeTerminalModal()` | Terminal | Fecha modal de terminal |
| `setTerminalLive(text, busy)` | Terminal | Atualiza conteúdo do terminal ao vivo |
| `livePollJob(jobId, onProgress)` | Terminal | Polling com output ao vivo (inspirado na V9) |
| `executeCmdLive(uid)` | Terminal | Executa comando exibindo output em tempo real |
| `loadDashboard()` | Dashboard | Busca `/status` e atualiza métricas (CPU/RAM/Disco/Uptime) |
| `fmtUptime(sec)` | Dashboard | Formata segundos em dias/horas/minutos |

### Novos elementos de UI
1. **Dashboard de métricas** — 4 cards (CPU, RAM, Disco, Uptime) com barras de progresso, atualizando a cada 5s.
2. **Botão de tema** 🌙/☀️ — alterna claro/escuro, persiste em `localStorage`.
3. **Estrela de favorito** ⭐ em cada card — clique para favoritar.
4. **Barra de favoritos** — chips clicáveis que executam o comando favorito.
5. **Painel de fila** — adiciona comandos à fila e executa em sequência.
6. **Botão "Ao Vivo" 📺** em cada card — executa no terminal modal com output em tempo real.
7. **Botão "Exportar Histórico" 📤** — baixa JSON com os últimos 50 comandos executados.
8. **Terminal modal** — janela dedicada com output ao vivo (estilo V9).
9. **Atalhos de teclado** — `Ctrl+K` (busca), `Ctrl+/` (IA), `Esc` (fecha modais).

### Novos padrões de persistência (localStorage)
- `mestre_v10_favs` — lista de UIDs favoritos
- `mestre_v10_history` — últimos 50 comandos executados
- `mestre_v10_theme` — tema selecionado (light/dark)

---

## 3. Compatibilidade

| Aspecto | V7 | V10 |
|---|---|---|
| Arquivo | monolítico HTML | monolítico HTML (mesmo padrão) |
| API Launcher | porta 7777 | porta 7777 (idêntica) |
| Ollama | localhost:11434 | localhost:11434 (idêntico) |
| CATS | 14 categorias | 19 categorias (14 V7 + 5 novas) |
| Funções JS | 21 | 38 (21 V7 + 17 novas) |
| Dependências | nenhuma | nenhuma |
| Launcher compatível | `MestreDoPC-Launcher.ps1` (porta 7777) | mesmo launcher (idêntico) |

> A V10 funciona com o **mesmo launcher PowerShell** da V7, sem necessidade de
> alterações no backend. Todas as novas funções usam os mesmos endpoints
> (`/run`, `/run-status`, `/ping`, `/status`, `/open-terminal`, `/mcp-status`).