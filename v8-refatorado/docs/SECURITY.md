# Seguranca — Mestre do PC V8

## Modelo de Ameacas

| ID | Ameaca | Mitigacao |
|----|--------|-----------|
| T1 | RCE via Invoke-Expression | Bloqueado pela allowlist e padroes perigosos |
| T2 | Command injection via argumentos | Sanitizacao reforcada no MCP (max length, escape aspas, anti-IEX) |
| T3 | CORS aberto (V7: `*`) | CORS restrito a origens configuradas |
| T4 | Execucao sem autenticacao | Auth por Bearer token (opcional); localhost sem auth |
| T5 | DoS via jobs infinitos | Rate limiting (100 req/min); timeout de jobs (900s) |
| T6 | Path traversal em arquivos estaticos | Verificacao de path normalizado vs staticRoot |
| T7 | Vazamento de logs | Logs em JSON, sem dados sensiveis; rotacao automatica |

## Configuracoes de Seguranca

### config.json

```json
{
  "cors": {
    "enabled": true,
    "allowedOrigins": ["http://localhost", "http://127.0.0.1"]
  },
  "apiAuth": {
    "enabled": false,
    "tokens": []
  },
  "port": 7777,
  "maxJobs": 5,
  "logDirectory": "logs"
}
```

### Recomendacoes

1. **Habilite auth** se expuser a API para a rede local:
   ```json
   "apiAuth": { "enabled": true, "tokens": ["seu-token-seguro-aqui"] }
   ```

2. **Restrinja origens CORS** para o dominio exato do seu frontend.

3. **Monitore logs** em `logs/launcher-YYYYMM.log` para detectar tentativas de abuso.

4. **Mantenha o Windows atualizado** — este software nao substitui patches de seguranca do SO.

## Diferencas do V7

| Aspecto | V7 | V8 |
|--------|-----|-----|
| Execucao de comandos | `Invoke-Expression` (arbitrario) | `Invoke-Command` com allowlist |
| CORS | `*` (qualquer origem) | Origens configuradas |
| Auth | Nenhuma | Bearer token (opcional) |
| Sanitizacao | `replace(/[`"']/g, "")` | Escape de aspas + anti-injection + max length |
| Jobs | `Start-Job` (novo processo) | `RunspacePool` (leve, reutilizavel) |
| Logging | Nenhum | JSON estruturado com rotacao |
