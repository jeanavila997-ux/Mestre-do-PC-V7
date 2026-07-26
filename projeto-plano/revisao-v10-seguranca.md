# Revisão de Segurança — Mestre do PC V10

**Revisor:** Claude Code  
**Data:** 2026-07-26  
**Branch:** `claude/revisao-6po651`  
**Base:** `b22e7ed` (Merge pull request #2)

## Sumário

Achados: **1 crítico**, **2 altos**, **4 médios**, **6 baixos**.

A revisão anterior (`projeto-plano/revisao-completa-v10.md`, commit `3363a93`) concluiu "nenhum
problema crítico". Esta revisão **discorda**: existe um furo de execução remota de código como
Administrador a partir de qualquer site aberto no navegador, usando `Access-Control-Allow-Origin: *`
sem autenticação.

---

## 🔴 CRÍTICO — Execução Remota de Código via CORS

**Severidade:** Crítico  
**Arquivos:** `MestreDoPC-Launcher.ps1`, `v10/launcher.js`  
**Rotas Afetadas:** `POST /run`, `POST /open-terminal`, `POST /ollama/chat`

### Descrição

Ambos os launchers (PowerShell e Node.js) respondem com:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Content-Type`

em **todas** as rotas, sem autenticação, sem validação de `Host`, sem validação de `Origin`.

Enquanto o launcher está no ar (sobe via tarefa agendada no logon, ativo por padrão), qualquer
página web visitada pode executar:

```javascript
fetch('http://127.0.0.1:7777/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cmd: '<qualquer PowerShell>' })
})
```

O preflight `OPTIONS` passa (origem aceita `*`, header aceito). O comando executa como
Administrador.

Um ataque de **DNS rebinding** contorna o CORS do navegador por completo — reescrever `127.0.0.1`
para o IP do atacante e fazer o navegador reenviar o request. Logo, checagem de `Host` é **crítica**
além de `Origin`.

### Locais Específicos

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| `MestreDoPC-Launcher.ps1` | 218–220 | Responde `Access-Control-Allow-Origin: *` em todas rotas |
| `MestreDoPC-Launcher.ps1` | 304–336 | `/run` não valida `Host`, `Origin`, nem autentica |
| `MestreDoPC-Launcher.ps1` | 107–137 | `New-CommandJob` → `Invoke-Expression` do texto cru elevado |
| `v10/launcher.js` | 20–35 | CORS `*` sem validação |
| `v10/launcher.js` | 173–178 | `/run` POST sem autenticação |
| `v10/launcher.js` | 53 | Lança PowerShell sem elevar (problema secundário) |

### Mitigação Proposta

1. **Validar `Host`** — aceitar só `127.0.0.1:7777`, `localhost:7777`, variantes com porta.
   Qualquer outro host → 403. Mata DNS rebinding.

2. **Token por sessão** — launcher gera UUID aleatório no boot, armazena em memória.
   Rotas mutáveis (`/run`, `/open-terminal`, `/ollama/chat`) exigem header `X-Mestre-Token`.
   Header custom força preflight CORS; sem o header na allow-list do launcher, navegador
   rejeita cross-origin.

3. **Restringir CORS** — `Access-Control-Allow-Origin: http://127.0.0.1:7777` (eco da origem
   permitida). Remover `*`.

4. **Injetar token na UI** — como a UI é servida (file:// ou http://127.0.0.1:7777),
   a página precisa receber o token:
   - Opção A: Servir `v10/index.html` pelo launcher (muda origem de `null` para `http://127.0.0.1:7777`).
   - Opção B: Injetar token no fragmento da URL (`#token=...`) via batch no `start-v10.bat`.

---

## 🟠 ALTO — Comando Sugerido pela IA Sem Confirmação

**Arquivos:** `v10/index.html:1230–1243`

### Descrição

`runIACmd()` extrai código PowerShell de um `<pre>` (gerado pela IA, possivelmente modelo cloud)
e chama `dispatchCommand()` diretamente. Não passa por `isDangerous()`, não pede confirmação.

É o caminho de maior risco — texto gerado por modelo que vira shell elevado — e é justamente o que
tem menos proteção. Cards curados (`CATS`) ao menos ganham badge visual.

### Solução

Aplicar `isDangerous()` a comandos sugeridos pela IA. Se perigoso, exibir modal de confirmação
dupla (padrão: V7 legado, item 5 da revisão anterior).

---

## 🟠 ALTO — Confirmação Dupla Não Implementada

**Arquivos:** `v10/index.html:1130`, `:1067`, `:771`

### Descrição

A revisão anterior marcou como feito: "marcar como danger **e pedir confirmação dupla**".
Apenas a primeira parte foi entregue:
- `isDangerous()` detecta padrões (`:1130`)
- Badge visual é desenhado (`:771`)

Mas `executeCmd()` (`:1067`) **nunca consulta** `isDangerous()`. Não há confirmação dupla.
O botão `[Executar]` roda o comando direto.

### Solução

Adicionar guard em `executeCmd()`: se `isDangerous(code)`, exibir modal de confirmação com
lista dos riscos (formato `wipe`, `format`, `reset TCP/IP`, etc.) e exigir duplo clique.

---

## 🟡 MÉDIO — Launcher Node.js Mente Sobre Estado

**Arquivo:** `v10/launcher.js`

### Problemas

#### 1. Admin Status Falso

Linha 157: `/ping` devolve `admin: true` fixo. Mas `launcher.js` roda `powershell.exe` sem elevar
(linha 53). A UI mostra "🟢 Launcher ativo — Execução direta habilitada." e os comandos falham com
acesso negado (permissão).

**Solução:** Checar elevação de verdade (via WMI ou procurando `Administrators`). Reportar status real.

#### 2. Active Jobs Falso

Linha 177: `/run` devolve `activeJobs: 1` fixo, ignorando estado real.

#### 3. Vazamento de Memória — Jobs Nunca Podados

- `Map jobs` (linha 18) cresce sem limite.
- Nenhum timeout: um PowerShell travado fica `running` para sempre.
- Versão PowerShell tem `JobRetentionMinutes = 30` e `JobTimeoutSeconds = 900` (linhas 32–33).

**Solução:** Implementar cleanup de jobs concluídos (30 min retenção) e timeout (15 min).

---

## 🟡 MÉDIO — Launcher PowerShell Single-Threaded

**Arquivo:** `MestreDoPC-Launcher.ps1`

### Problema

O loop principal é single-threaded sobre `$listener.GetContext()` (linha 213). O streaming de
`/ollama/chat` (linhas 360–400) segura o loop inteiro até o modelo terminar. Durante um chat com
IA:
- `/run-status` e `/status` não respondem
- Dashboard e fila de comandos aparecem congelados

**Efeito colateral:** `Cleanup-CommandJobs` (linhas 51–100) só roda quando chega requisição. Timeout
de job não é aplicado com servidor ocioso.

**Solução (baixa prioridade):** Usar `HttpListener` com `async/await` ou `BeginGetContext()` para
não bloquear, ou segregar streaming em thread separada.

---

## 🟡 MÉDIO — CI Só Valida Código Arquivado

**Arquivo:** `.github/workflows/ci.yml:15`

### Problema

`working-directory: legado/MestreDoPC-V7`

Lint, typecheck, test, build rodam **exclusivamente** na pasta `legado/`. Nada em:
- `v10/`
- `mcp-server/`
- Scripts PowerShell (`MestreDoPC-Launcher.ps1`, `install.ps1`, etc.)

Um erro de sintaxe em `mcp-server/index.js` passa com CI verde.

**Solução:**
1. Mover CI para validar `mcp-server/` (lint ESLint/Node, `npm test`).
2. Adicionar validação PowerShell (PSScriptAnalyzer).
3. Opcionalmente, validar `v10/index.html` (HTML lint, CSP check).

---

## 🟡 MÉDIO — `README.md` Desatualizado e Duplicado

**Arquivo:** `README.md` (raiz)

### Problema

`README.md` é idêntico a `mcp-server/README.md`. A página inicial do repositório documenta **só**
o servidor MCP:
- Não menciona V10 (versão ativa)
- Não menciona launcher PowerShell
- Não menciona `INSTALAR.bat`, `install.sh`
- Não descreve a estrutura atual

Além disso, ambos listam ferramentas que **não existem** em `mestreTools`:
- prefetch
- desfragmentar
- TRIM SSD
- reset TCP/IP
- firewall
- scan completo
- reparar WU

**Solução:**
1. Criar `README.md` que descreve a V10 como ativa
2. Incluir fluxo de instalação (`INSTALAR.bat`, `install.ps1`, `install.sh`)
3. Listar apenas as 33 ferramentas MCP que realmente existem
4. Referências cruzadas para `projeto-plano/` (roadmap, roadmap de versão)

---

## 🟡 MÉDIO — `CLAUDE.md` Descreve Estrutura Fantasma

**Arquivo:** `CLAUDE.md`

### Problema

Depois da reorganização (commit `7cbf0f5`), ficou defasado:

| Afirmação | Realidade |
|-----------|-----------|
| "index.js / package.json na raiz espelham mcp-server/" | Nenhum dos dois existe na raiz |
| Descreve v7/, v8/, v8-refatorado/, v9/, pwa-starter/ | Todos em `legado/` ou removidos |
| Menciona `design-tokens.css`, `assets/` na raiz | Não existem; estão em `legado/` |
| Nunca menciona `v10/` | **`v10/` é a versão ativa** |
| Não menciona `v10/launcher.js` | Principal executável |
| Não menciona `startup/` | Pasta do Ollama warm-up |
| Não menciona `install.sh` | Instalador Linux/macOS |
| "start-mestre.bat abre a interface" | Abre `legado/MestreDoPC-Ultimate-v7.html` |

Quem seguir esse arquivo edita os arquivos errados (legado/ ao invés de v10/, mcp-server/).

**Solução:** Reescrever seção "Arquitetura" e "Comandos" para refletir V10 como ativa.

---

## 🟢 BAIXO — Problemas Menores

### 1. Formatação Excessiva em `mcp-server/index.js`

909 linhas de arquivo, ~455 de código efetivo. Espaçamento entre quase todas as linhas torna
leitura tediosa.

**Solução:** Remover linhas em branco excedentes (máx. 1 entre blocos).

### 2. Unhandled Rejection em `/api/pull`

`mcp-server/index.js:675–681`

```javascript
fetch(OLLAMA_URL + "/api/pull", { 
  method: "POST", 
  body: JSON.stringify({ name: OLLAMA_MODEL, stream: false }) 
});
```

Sem `.catch()`. Sem `Content-Type`. Unhandled rejection pode derrubar o processo MCP.

### 3. Timeout Error vs Abort Error

`mcp-server/index.js:743, 795, 874`

`AbortSignal.timeout()` rejeita com `TimeoutError`, não `AbortError`. Os branches
`if (error.name === "AbortError")` nunca disparam.

### 4. Versões Descasadas

- `mcp-server/package.json:3` — `version: 1.0.0`
- `mcp-server/index.js:141` — `version: "1.0.0"`
- Produto — `v10.0.0`

Deveria ser `10.0.0` ou explicitar que é versão MCP (`1.0.0`).

### 5. `npm test` Stub

`mcp-server/package.json:9` — `"test": "echo \"Error: no test specified\" && exit 1"`

Falha sempre. Deveria ser skip ou implementar testes reais.

### 6. `.gitignore` Inconsistente

`.gitignore:23` — lista `.claude/` mas há 4 arquivos `.claude/` versionados:
- `.claude/ecc-tools.json`
- `.claude/homunculus/instincts/inherited/Mestre-do-PC-V7-instincts.yaml`
- `.claude/identity.json`
- `.claude/skills/Mestre-do-PC-V7/SKILL.md`

---

## Recomendações — Prioridade

| # | Severidade | Item | Esforço | Bloqueia |
|---|---|---|---|---|
| 1 | 🔴 Crítico | CORS + Host check + token | 4h | Sim — segurança |
| 2 | 🟠 Alto | Confirmação dupla para perigo | 2h | Não — UX |
| 3 | 🟠 Alto | IA cmd via `isDangerous()` | 1h | Não — UX |
| 4 | 🟡 Médio | launcher.js: admin/jobs corretos | 2h | Não |
| 5 | 🟡 Médio | CI validar v10/ + mcp-server/ | 3h | Não — CI/CD |
| 6 | 🟡 Médio | README.md ativo + ferramentas reais | 1.5h | Não — docs |
| 7 | 🟡 Médio | CLAUDE.md realinhar v10 | 1h | Não — docs |
| 8 | 🟢 Baixo | Limpeza mcp-server/index.js | 0.5h | Não |
| 9 | 🟢 Baixo | Timeout error, unhandled, version | 1h | Não |

---

## Conclusão

O projeto está **funcionalmente completo** para uso pessoal. Porém, o furo de CORS é **crítico de
segurança** e deve ser fechado antes de qualquer compartilhamento ou recomendação de uso público.

A documentação ficou defasada após a reorganização e guia users/agentes para editar arquivos
errados.

Os problemas altos (confirmação dupla, IA sem trava) foram prometidos em revisão anterior e
ficaram pela metade — baixa prioridade técnica, mas enfraquece a confiança.
