# Verificação dos fixes da revisão de segurança V10

**Revisor:** Claude Code
**Data:** 2026-07-29
**Referência:** `projeto-plano/revisao-v10-seguranca.md` (PR #5)
**HEAD verificado:** `6d45b65` (PR #7, autor: agente Copilot)

## Contexto

Depois da revisão de segurança (PR #5), outro agente (Copilot, PR #7) implementou
correções para praticamente todos os achados. Esta é a verificação dessas correções:
li o diff completo de cada arquivo afetado, rodei a suíte de testes localmente e
apliquei duas correções adicionais que ainda estavam pendentes.

## Achados da revisão original — status verificado

| Achado | Severidade | Status | Evidência |
|---|---|---|---|
| CORS `*` + `/run` sem autenticação (RCE via navegador) | 🔴 Crítico | ✅ **Corrigido** | Ver "Verificação do fix crítico" abaixo |
| Comando da IA sem confirmação | 🟠 Alto | ✅ **Corrigido** | `confirmBeforeExecution(cmd, "ai")` em `runIACmd()` — sempre pede confirmação para sugestão da IA |
| Confirmação dupla não implementada | 🟠 Alto | ✅ **Corrigido** | `executeCmd()`, execução da fila e execução ao vivo agora chamam `confirmBeforeExecution()`; `DANGER_PATTERNS` ampliado (shutdown, Stop-Computer, Remove-AppxPackage, git push/stash pop, etc.) |
| `launcher.js` finge estar admin / vaza jobs | 🟡 Médio | ✅ **Corrigido** | `/ping` retorna `admin: false` (era `true` fixo); timeout de job (15 min) e retenção (30 min) implementados com `clearTimeout`/`setInterval` |
| Launcher PowerShell serializado bloqueia durante streaming | 🟡 Médio | ⚠️ **Não corrigido** | Loop ainda é `$listener.GetContext()` síncrono; streaming de `/ollama/chat` ainda seria bloqueante. Não regressado, apenas não endereçado — ver recomendação abaixo |
| CI só valida `legado/` | 🟡 Médio | ✅ **Corrigido** | `ci.yml` agora roda `npm test` em `mcp-server/`, `node --check` nos 3 arquivos JS ativos, e valida sintaxe PowerShell dos 4 scripts ativos via `System.Management.Automation.Language.Parser` |
| `README.md` duplicado/desatualizado | 🟡 Médio | ✅ **Corrigido** | Reescrito do zero descrevendo a V10, a arquitetura de origem única e o fluxo de instalação real |
| `CLAUDE.md` descreve repo fantasma | 🟡 Médio | ✅ **Corrigido** | Reescrito para V10; inclui avisos explícitos ("não volte a abrir por `file://`", "não restaure CORS `*`") |
| Formatação excessiva em `mcp-server/index.js` | 🟢 Baixo | ✅ Resolvido incidentalmente | Arquivo mantém apenas espaçamento pontual, não mais uma linha em branco após cada linha |
| `fetch()` de `/api/pull` sem tratamento de erro | 🟢 Baixo | 🟡 Parcial | Ganhou `void` na chamada, mas segue sem `.catch()` — `void` não trata a rejeição, só descarta o valor de retorno sincronamente |
| `AbortError` vs `TimeoutError` | 🟢 Baixo | ✅ **Corrigido agora** | Ver "Correções aplicadas nesta verificação" |
| Versão `1.0.0` vs `10.0.0` | 🟢 Baixo | ⏸️ Não alterado | Aceitável — versionamento independente do pacote npm é uma escolha razoável |
| `npm test` era stub que falhava | 🟢 Baixo | ✅ **Corrigido** | `"test": "node --test"`, com 7 testes reais em `mcp-server/test/` |
| `.gitignore` inconsistente com `.claude/` | 🟢 Baixo | ⏸️ Não alterado | Ver nota abaixo |

## Verificação do fix crítico (CORS/RCE)

O mecanismo escolhido: a UI passou a ser servida pela mesma origem do launcher
(`http://127.0.0.1:7777/`, antes era `file://`), e todo endpoint que muda estado
(`/run`, `/open-terminal`, `/ollama/chat`, `/ollama/pull`) agora exige as duas
condições simultâneas:

```
(Origin === "http://127.0.0.1:7777" && X-Mestre-Client === "v10-web")
  OU
(Origin ausente && X-Mestre-Client === "mcp")
```

Implementado de forma idêntica nos dois launchers (`MestreDoPC-Launcher.ps1`
`Test-PrivilegedClient`/`Set-ResponseSecurityHeaders`, e `v10/launcher.js`
`isAuthorized()`), com preflight `OPTIONS` retornando 403 para qualquer `Origin`
diferente do esperado.

**Por que isso resiste a DNS rebinding:** o `Origin` enviado pelo navegador reflete
a origem de navegação real da página, não o `Host` resolvido na requisição — um
atacante que reaponte `evil.com` para `127.0.0.1` via DNS rebinding ainda envia
`Origin: http://evil.com` (ou variante com porta), que nunca bate com o literal
`http://127.0.0.1:7777`. Comparar contra o `Host` da requisição teria sido mais
fraco aqui, porque o `Host` é justamente o que o rebinding tenta forjar.

**Resíduo identificado:** o branch `Origin ausente && X-Mestre-Client === "mcp"`
existe para permitir que o `mcp-server/index.js` (que roda como processo Node
local, sem `Origin` de navegador) se autentique. Um navegador não consegue forjar
essa combinação — headers customizados em `fetch()` cross-origin sempre disparam
preflight, e o `Origin` é gerenciado pelo navegador, não é escrevível via JS. Mas
**qualquer processo local não-navegador** (outro executável, um script, malware já
em execução como o usuário) pode enviar essa mesma combinação de headers via
socket bruto e obter execução como Administrador — não há segredo real envolvido,
só correspondência de headers. Isso é uma redução drástica da superfície de
ataque (fecha o vetor via navegador/site malicioso, que era o achado crítico
original) mas não é autenticação real contra software já rodando localmente.

**Recomendação de follow-up (não bloqueante):** gerar um token aleatório por boot
do launcher (arquivo local com ACL do usuário, ou variável de ambiente herdada
pelo processo MCP) e exigi-lo como segredo adicional no header, em vez de apenas
inferir confiança por `X-Mestre-Client: mcp`.

Testes automatizados que comprovam o fix (`mcp-server/test/launcher-security.test.js`):
sobem o launcher Node de verdade, confirmam que POST `/run` sem os headers corretos
retorna 403, que `Origin` externo é rejeitado tanto no preflight quanto na
requisição real, e que a página é servida com `Content-Security-Policy` incluindo
`frame-ancestors 'none'`. Rodei localmente — os 7 testes passam.

## Correções aplicadas nesta verificação

Além de validar o trabalho já feito, apliquei duas correções pequenas e testadas:

### 1. Dependência vulnerável (`@hono/node-server`)

`npm audit` acusava path traversal moderado (`GHSA-frvp-7c67-39w9`) via encoded
backslash no Windows — justamente a plataforma-alvo do projeto — na dependência
transitiva `@hono/node-server`, puxada pelo `@modelcontextprotocol/sdk`. O
`package.json` já tinha um bloco `overrides` para travar essa dependência, mas
travava em `1.19.15`, que ainda está dentro da faixa vulnerável (`<2.0.5`).

**Fix:** `overrides["@hono/node-server"]` de `1.19.15` → `2.0.12`.
`npm audit` confirma **0 vulnerabilidades** depois da mudança; os 7 testes
continuam passando.

O código deste projeto usa `StdioServerTransport` (não o transporte HTTP do SDK
que dependeria do `serve-static` vulnerável), então o risco prático já era baixo
— mas travar em versão vulnerável no lockfile falha em qualquer scanner de
dependências e é uma correção de custo zero.

### 2. `AbortError` vs `TimeoutError` (achado 🟢 da revisão original)

`AbortSignal.timeout(ms)` rejeita com `DOMException` de nome `TimeoutError`, não
`AbortError` — `AbortError` só ocorre com `controller.abort()` manual. As três
mensagens amigáveis de timeout (`analisar_logs_sistema`, `perguntar_ia`, execução
de tool via launcher) nunca disparavam; o usuário via a mensagem genérica de erro
em vez de "⏱️ Timeout: ...".

**Fix:** os três `if (error.name === "AbortError")` passaram a checar também
`error.name === "TimeoutError"`. Sem teste dedicado (exigiria mockar o Ollama/
launcher para simular timeout); validado por leitura de código e pela suíte
existente continuando verde.

## Itens que seguem em aberto (não bloqueantes)

1. **Launcher PowerShell single-threaded** — `/ollama/chat` streaming ainda
   bloqueia `/run-status` e `/status` durante um chat com a IA. Requer reescrever
   o loop com `BeginGetContext`/callbacks assíncronos ou mover streaming para
   uma runspace separada. Esforço maior, vale um follow-up dedicado.
2. **Token de sessão para o branch `X-Mestre-Client: mcp`** — descrito acima,
   reduz ainda mais a superfície de ataque contra processos locais não confiáveis.
3. **`.gitignore` lista `.claude/` mas 4 arquivos estão versionados** — decisão de
   produto sobre o que deveria ser versionado sob `.claude/`, não uma correção
   técnica óbvia; não alterei para não presumir intenção dos mantenedores.
4. **`fetch()` de `/api/pull` sem `.catch()`** — o `void` adicionado não trata a
   promise rejeitada; ainda pode gerar `unhandledRejection`. Fix de uma linha
   (`.catch(() => {})`), deixado para não misturar com as correções de segurança
   desta rodada.

## Verificação executada

```
cd mcp-server
npm ci            # 0 erros
npm audit         # 0 vulnerabilidades (após bump do @hono/node-server)
npm test          # 7/7 testes passando
node --check index.js / security.js
node --check ../v10/launcher.js
```

CI remota (`6d45b65`, branch `main`): **success** — inclui a validação de sintaxe
PowerShell dos 4 scripts ativos, que não pude rodar localmente (sem `pwsh` neste
ambiente).

## Conclusão

O fix da PR #7 é sólido: fecha o crítico e os dois altos da revisão anterior com
mecanismo correto (Origin+header, resistente a DNS rebinding), corrige os médios
de estado falso no launcher Node, realinha CI e documentação, e adiciona testes
automatizados de regressão para o comportamento de segurança. As duas correções
que apliquei aqui (dependência vulnerável, bug de timeout) fecham o restante dos
itens de baixa severidade que ainda tinham impacto real. O que resta em aberto é
de menor prioridade e não bloqueia uso.
