# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com o código deste repositório.

## O que é este projeto

Mestre do PC V7 — uma ferramenta de manutenção/otimização para Windows (interface e documentação
em português) que expõe comandos do sistema (RAM, disco, rede, Windows Defender, reparo
SFC/DISM, logs de eventos, consultas locais ao Ollama) para assistentes de IA via Model Context
Protocol (MCP), além de uma interface administrativa equivalente no navegador.

## Comandos

```bash
# Instalar as dependências do servidor MCP
cd mcp-server && npm install

# Rodar o servidor MCP diretamente (normalmente é o Claude Desktop quem o inicia via stdio,
# não costuma ser executado manualmente)
cd mcp-server && npm start   # node index.js

# Instalação local completa (eleva para Admin, instala dependências, registra tarefa agendada +
# configuração MCP do Claude Desktop, cria atalhos)
INSTALAR.bat                  # invoca install.ps1
uninstall.ps1                 # desfaz o que foi feito acima (mantém a pasta de instalação)

# Iniciar/verificar a stack em execução (checa a saúde do launcher, abre a interface HTML)
start-mestre.bat
```

Não há suíte de testes para `mcp-server/` — `npm test` é um stub não implementado.
(`v8-refatorado/src/tests/*.ps1` tem scripts no estilo Pester, mas só para o launcher dessa versão.)

A maior parte dos comandos reais deste repositório (PowerShell, WMI, Defender, DISM/SFC) só faz
algo em Windows, e somente com o `MestreDoPC-Launcher.ps1` rodando elevado. Trabalhar no nível do
Node em `mcp-server/index.js` (editar definições de tools, checar se inicia/faz parse) não exige
isso.

## Arquitetura

**Divisão em dois processos, não um servidor único.** `mcp-server/index.js` é um servidor MCP via
stdio (`@modelcontextprotocol/sdk`) que o Claude Desktop inicia — ele define/anuncia as tools mas
**não** executa PowerShell diretamente. Em vez disso, faz POST para um "Launcher" HTTP separado,
rodando elevado (`MestreDoPC-Launcher.ps1`, escuta em `127.0.0.1:7777`), via
`executeLauncherCommand()`: POST em `/run` para submeter um comando, e polling em
`/run-status?id=...` até concluir. Essa divisão existe porque o processo do servidor MCP em si não
roda elevado, mas os comandos de manutenção do sistema precisam de Admin. A interface no navegador
(`api.js` / `window.MestreAPI`) fala com o mesmo contrato HTTP do launcher (`ping` / `run` /
`run-status`) — é um segundo cliente do mesmo backend, não uma implementação separada.

Algumas tools ignoram o launcher completamente e chamam uma instância local do Ollama
(`http://localhost:11434`) diretamente: `perguntar_ia`, `analisar_logs_sistema`,
`verificar_modelo_ollama`.

**Adicionar uma tool MCP** normalmente é uma mudança de uma entrada só, sem código novo: adicione
`{description, command}` ao objeto `mestreTools` em `mcp-server/index.js`, onde `command` é uma
string de PowerShell crua. Tokens `{{PLACEHOLDER}}` dentro de `command` são varridos
automaticamente para montar o JSON schema de entrada da tool, e os valores substituídos são
sanitizados por uma regex de whitelist (`[^a-zA-Z0-9\-_. ]`) antes de serem enviados ao launcher.
Só escreva um handler dedicado (`if (name === ...)`) quando a tool precisar de lógica além de
"rodar este comando PowerShell" (como as três tools do Ollama).

**`mcp-server/` é a versão canônica; a raiz do repo é uma quase-duplicata.** `index.js` e
`package.json` na raiz espelham quase exatamente `mcp-server/index.js` / `mcp-server/package.json`
— trate `mcp-server/` como fonte da verdade e tenha em mente que edições podem precisar ser
replicadas (ou que a cópia da raiz deveria ser aposentada), em vez de assumir que existe apenas
uma implementação do servidor MCP.

**`v7/`, `v8/`, `v8-refatorado/` e `v9/` são iterações paralelas e autocontidas**, não artefatos de
build — cada uma tem seu próprio launcher, interface HTML e `package.json`. `v8-refatorado/` é a
mais evoluída: um launcher PowerShell modular dividido em `src/launcher/`, `src/security/`
(allowlist de comandos, rate limiting), `src/frontend/`, `src/config/`, com seu próprio
`mcp-server/` e endpoints tanto legados (`/run`) quanto novos (`/api/*`). Os arquivos HTML
"promovidos" na raiz (`MestreDoPC-Ultimate-v7.html`, `MestreDoPC-V8-Preview.html`,
`MestreDoPC-V9-Designs.html`) espelham o `index.html` da pasta de versão correspondente, com
`-Ultimate-v7` permanecendo quase sincronizado com `v7/index.html`, enquanto os de V8/V9
divergiram mais. Ao alterar UI ou launcher, confirme qual pasta (raiz ou uma pasta `v*`) é
realmente a pretendida.

**Cadeia de instalação/registro**: `INSTALAR.bat` eleva e roda `install.ps1` (verifica o Node,
instala as dependências do `mcp-server`, chama `Register-MestreTask.ps1` para agendar o
`MestreDoPC-Launcher.ps1` oculto como Administrador, registra o servidor MCP no
`claude_desktop_config.json` do Claude Desktop via `MESTRE_PROJETO_PATH`, cria atalhos).
`start-mestre.bat` checa a tarefa agendada, verifica a saúde de `127.0.0.1:7777/ping` e abre a
interface HTML. `sync-mestre.ps1` sincroniza arquivos vindos de uma árvore irmã
`Administrador`/`Mestre_Dados` que fica **fora** deste clone do repositório — não funciona de
forma isolada aqui.

`pwa-starter/` é um scaffold do PWABuilder (Lit + Vite + Workbox) sem modificações, sem relação com
o resto do código — não assuma que está integrado a nada.

`design-tokens.css` / `assets/` são uma folha de estilos com design tokens compartilhados + uma
cópia duplicada de `api.js`, e atualmente não são referenciados por nenhum `<link>`/`<script>` nos
arquivos HTML do repositório.
