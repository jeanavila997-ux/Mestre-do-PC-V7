# Security Guide - MestreDoPC V7

## Visão Geral

Este documento descreve as medidas de segurança implementadas no MestreDoPC V7 MCP Server para prevenir injeção de comandos, execução não autorizada e vazamento de dados.

## ⚠️ Ameaças Mitigadas

### 1. Injeção de Comandos PowerShell

**Ameaça:** Usuário malicioso tenta injetar comandos arbitrários via parâmetros.

```json
{
  "tool": "limpeza_rapida_completa",
  "params": {
    "dryRun": "true; rm -rf C:\\Windows"
  }
}
```

**Mitigação:** `sanitizer.ts` escapa todos os caracteres especiais:
- `;` → `` `; ``
- `&` → `` `& ``
- `|` → `` `| ``
- `$()` → `` `$() ``

### 2. Parâmetros Não Autorizados

**Ameaça:** Adicionar parâmetros não documentados para modificar comportamento.

```json
{
  "tool": "verificar_disco",
  "params": {
    "driveLetter": "C",
    "force": "true",  // Parâmetro não autorizado!
    "silent": "true"  // Parâmetro não autorizado!
  }
}
```

**Mitigação:** `whitelist.ts` valida estritamente:
- Apenas parâmetros conhecidos são aceitos
- Valores devem corresponder a patterns definidos
- Parâmetros obrigatórios são verificados

### 3. Comandos Destrutivos

**Ameaça:** Execução de comandos destrutivos (del, format, partition).

**Mitigação:** `detectInjection()` bloqueia:
- `rm`, `del`, `remove`
- `format`, `partition`
- Redirecionamento (`>`, `<`)

## 🔒 Como Funciona a Segurança

### Fluxo de Validação

```
1. Recebe parâmetros do client MCP
         ↓
2. validateToolParams() → whitelist.ts
         ↓
3. detectInjection() → sanitizer.ts (para cada valor)
         ↓
4. buildSafeCommand() → escapeString() + encodeCommand()
         ↓
5. Executa via launcher com -EncodedCommand
```

### Exemplo de Comando Seguro

**Input:**
```typescript
executeLauncherCommand('Get-Process', { Name: 'notepad;rm -rf /' });
```

**Processamento:**
```typescript
// 1. Valida whitelist
validateToolParams('Get-Process', { Name: 'notepad;rm -rf /' });
// ✅ Passa (Name é parâmetro válido)

// 2. Detecta injeção
detectInjection('notepad;rm -rf /');
// ❌ Falha! Detecta ';' e 'rm'

// 3. Se passar, escapa
escapeString('notepad;rm -rf /');
// Result: 'notepad`;rm`;rm` -rf` /'

// 4. Codifica
encodeCommand('Get-Process -Name "notepad`;rm`;rm` -rf` /"');
// Result: Base64 do comando em UTF-16LE
```

## 🧪 Modo Simulation

Para desenvolvimento e testes, use o modo **simulation** que loga comandos sem executá-los:

```bash
# Linux/Mac
export SIMULATION_MODE=true
npm start

# Windows PowerShell
$env:SIMULATION_MODE="true"
npm start
```

**Output:**
```json
{
  "simulated": true,
  "command": "powershell -EncodedCommand RwBlAHQALQ...",
  "message": "Command would be executed in simulation mode"
}
```

## ✅ Testes de Segurança Obrigatórios

Antes de cada release, execute:

### Teste 1: Injeção via Semicolon

```json
{
  "tool": "limpeza_rapida_completa",
  "params": { "dryRun": "true; whoami" }
}
```

**Resultado esperado:** `detectInjection()` retorna `true`, comando é rejeitado.

### Teste 2: Injeção via Pipe

```json
{
  "tool": "verificar_disco",
  "params": { "driveLetter": "C|whoami" }
}
```

**Resultado esperado:** `escapeString()` converte para `C`|whoami`.

### Teste 3: Parâmetro Desconhecido

```json
{
  "tool": "reset_windows_update",
  "params": { "confirm": "true", "force": "true" }
}
```

**Resultado esperado:** `validateToolParams()` rejeita `force`.

### Teste 4: Command Substitution

```json
{
  "tool": "perguntar_ia",
  "params": { "prompt": "$(whoami)" }
}
```

**Resultado esperado:** `detectInjection()` detecta `$()`.

## 🛡️ Boas Práticas Adicionais

### 1. Execute como Usuário Limitado

**NUNCA** execute o MCP Server como Administrador.

```powershell
# Crie um usuário dedicado
net user mestredopc /add

# Execute o serviço como este usuário
sc create MestreDoPC binPath= "node C:\MestreDoPC-V7\dist\index.js"
sc config MestreDoPC obj= ".\mestredopc"
```

### 2. Configure Firewall

Restrinja acesso à porta 7777:

```powershell
# Apenas localhost
netsh advfirewall firewall add rule name="MestreDoPC Launcher" dir=in action=allow protocol=TCP localport=7777 remoteip=127.0.0.1
```

### 3. Habilite Logging

```bash
export LOG_LEVEL=debug
```

Monitore logs em busca de:
- Múltiplas tentativas de injeção
- Ferramentas não usuais sendo chamadas
- Horários atípicos de execução

### 4. Atualize Dependências

```bash
# Semanalmente
npm audit
npm update

# Mensalmente
npm outdated
npm install <package>@latest
```

## 🚨 Resposta a Incidentes

### Se Detectar Injeção Bem-Sucedida

1. **Pare o servidor imediatamente:**
   ```bash
   Ctrl+C
   ```

2. **Isole a máquina:**
   - Desconecte da rede
   - Desabilite Wi-Fi

3. **Analise logs:**
   ```bash
   grep "injection" logs/*.log
   ```

4. **Revise permissões:**
   ```powershell
   whoami
   net localgroup administrators
   ```

5. **Reporte:**
   - Crie issue no GitHub
   - Inclua logs (remova dados sensíveis)

## 🔐 Checklist de Deploy

Antes de deploy em produção:

- [ ] Todos os testes de segurança passam
- [ ] Modo simulation desabilitado
- [ ] LOG_LEVEL = 'warn' ou 'error'
- [ ] Firewall configurado (apenas localhost)
- [ ] Serviço rodando como usuário limitado
- [ ] Backup dos logs habilitado
- [ ] Monitoramento de tentativas de injeção

## 📚 Referências

- [PowerShell Security Best Practices](https://learn.microsoft.com/en-us/powershell/scripting/community/security-details)
- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [MCP SDK Security](https://github.com/modelcontextprotocol/specification)

## Contato

Para reportar vulnerabilidades de segurança, abra uma issue com a label `security`.
