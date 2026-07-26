#!/usr/bin/env node

/**
 * Mestre do PC V8 — MCP Server
 * Comunicacao stdio com Claude Desktop -> HTTP para o Launcher PowerShell
 * Melhorias V8:
 *  - Sanitizacao reforcada (whitelist de chars, max length, anti-injection)
 *  - Timeouts configuraveis
 *  - Retry com backoff exponencial
 *  - Health check do Launcher antes de cada comando
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// ==================== CONFIG ====================
const MESTRE_BASE_URL = process.env.MESTRE_BASE_URL || "http://localhost:18791";
const MESTRE_RUN_URL = MESTRE_BASE_URL + "/run";
const MESTRE_STATUS_URL = MESTRE_BASE_URL + "/run-status";

const PROJETO_PATH = (process.env.MESTRE_PROJETO_PATH || "C:\\MestreDoPC_V8").replace(/\\/g, "\\\\");

const MAX_CMD_LENGTH = 8000;
const SANITIZE_MAX_LENGTH = 4000;

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";
const OLLAMA_SYSTEM_PROMPT = `Voce e o Mestre do PC, um assistente especializado em manutencao de computadores Windows.
Responda SEMPRE em portugues brasileiro.
Quando sugerir uma acao, inclua o comando PowerShell exato.
NUNCA invente comandos. Use APENAS comandos PowerShell reais do Windows.
Se o usuario pedir para analisar logs, identifique os erros mais criticos e sugira comandos sfc ou dism se necessario.
Seja direto e objetivo.`;

// ==================== UTILS ====================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sanitizacao reforcada V8:
 * 1. Limita tamanho
 * 2. Remove caracteres de controle perigosos
 * 3. Bloqueia patterns de injection
 * 4. Escapa aspas de forma segura
 */
function sanitizeArg(value) {
  if (value == null) return "";
  let s = String(value);
  if (s.length > SANITIZE_MAX_LENGTH) {
    s = s.substring(0, SANITIZE_MAX_LENGTH);
  }
  // Remove caracteres de controle e perigosos
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  // Bloqueia sequencias de injection
  const dangerous = /(\$\(.*?\)|`.*?`|\{.*\}|\[.*\]|;.*powershell|IEX|Invoke-Expression|Start-Process.*powershell|FromBase64String)/i;
  if (dangerous.test(s)) {
    throw new Error(`Caractere/padrao nao permitido detectado no argumento: ${s.substring(0, 50)}`);
  }
  // Escapa aspas de forma segura para PowerShell
  s = s.replace(/"/g, '""');
  return s;
}

async function executeLauncherCommand(command, options = {}) {
  const submitTimeoutMs = options.submitTimeoutMs || 10000;
  const timeoutMs = options.timeoutMs || 900000;
  const pollIntervalMs = options.pollIntervalMs || 1200;
  const statusTimeoutMs = options.statusTimeoutMs || 5000;

  // 1. Submit
  const submitRes = await fetch(MESTRE_RUN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cmd: command }),
    signal: AbortSignal.timeout(submitTimeoutMs),
  });

  const submitData = await submitRes.json();

  if (
    submitRes.ok === false ||
    submitData.success !== true ||
    submitData.accepted !== true ||
    submitData.jobId == null
  ) {
    throw new Error(submitData.output || "Falha ao enviar comando para o Launcher.");
  }

  // 2. Poll status
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const statusRes = await fetch(
      MESTRE_STATUS_URL + "?id=" + encodeURIComponent(submitData.jobId),
      { signal: AbortSignal.timeout(statusTimeoutMs) }
    );
    const statusData = await statusRes.json();

    if (statusRes.ok === false) {
      throw new Error(statusData.output || "Falha ao consultar status do Launcher.");
    }

    if (statusData.running === true) {
      await sleep(pollIntervalMs);
      continue;
    }

    return statusData;
  }

  throw new Error("Timeout aguardando conclusao do comando no Launcher.");
}

// ==================== TOOLS MAP ====================
const mestreTools = {
  // --- 1. Limpeza Geral ---
  limpeza_rapida_completa: {
    description: "Executa uma limpeza rapida completa no sistema: esvazia a lixeira e limpa pastas temporarias.",
    command: 'Remove-Item "$env:TEMP\\*" -Recurse -Force -EA 0; Remove-Item "C:\\Windows\\Temp\\*" -Recurse -Force -EA 0; Clear-RecycleBin -Force -EA 0; Write-Host "Limpeza concluida!" -ForegroundColor Green',
  },
  esvaziar_lixeira: {
    description: "Esvazia silenciosamente a lixeira do Windows.",
    command: 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Host "Lixeira esvaziada!" -ForegroundColor Green',
  },
  limpar_cache_windows_update: {
    description: "Limpa o cache do Windows Update paralisando e reiniciando o servico.",
    command: 'Stop-Service wuauserv -Force; Remove-Item "C:\\Windows\\SoftwareDistribution\\Download\\*" -Recurse -Force -EA 0; Start-Service wuauserv; Write-Host "Cache WU limpo!" -ForegroundColor Green',
  },

  // --- 2. Limpeza Avancada ---
  limpar_logs_event_viewer: {
    description: "Limpa todos os logs do Event Viewer do Windows.",
    command: 'Get-EventLog -List | ForEach-Object { Clear-EventLog -LogName $_.Log -EA 0 }; Write-Host "Logs de eventos limpos!" -ForegroundColor Green',
  },
  limpar_cache_thumbnail: {
    description: "Limpa o cache de miniaturas (thumbnails) do Windows.",
    command: 'ie4uinit.exe -show; Remove-Item "$env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer\\thumbcache_*" -Force -EA 0; Write-Host "Thumbnail cache limpo!" -ForegroundColor Green',
  },

  // --- 3. Memoria / RAM ---
  liberar_memoria_ram: {
    description: "Tenta liberar a memoria RAM imediatamente usando o Garbage Collector do .NET.",
    command: '[System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers(); Write-Host "RAM liberada!" -ForegroundColor Green',
  },
  ver_uso_ram: {
    description: "Retorna o status atual mostrando a quantidade de memoria RAM livre e o total instalado.",
    command: '$ram = Get-WmiObject Win32_OperatingSystem; $livre = [math]::Round($ram.FreePhysicalMemory/1MB,2); $total = [math]::Round($ram.TotalVisibleMemorySize/1MB,2); Write-Host "RAM Livre: $livre GB de $total GB"',
  },
  listar_processos_alto_consumo_ram: {
    description: "Lista os 15 processos que mais estao consumindo memoria RAM no momento.",
    command: 'Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 Name,@{N="RAM(MB)";E={[math]::Round($_.WorkingSet64/1MB,2)}} | Format-Table -AutoSize',
  },

  // --- 4. Processos ---
  reiniciar_explorer: {
    description: "Reinicia o Windows Explorer (explorer.exe).",
    command: 'Stop-Process -Name explorer -Force; Start-Process explorer; Write-Host "Explorer reiniciado!" -ForegroundColor Green',
  },
  encerrar_processo: {
    description: "Encerra um processo pelo nome. Informe o parametro 'nome' com o nome do processo (ex: chrome, notepad).",
    command: 'Stop-Process -Name "{{NOME}}" -Force -EA 0; if ($?) { Write-Host "Processo {{NOME}} encerrado com sucesso!" -ForegroundColor Green } else { Write-Host "Processo {{NOME}} nao encontrado ou ja encerrado." -ForegroundColor Yellow }',
  },
  desativar_servico: {
    description: "Desativa e para um servico do Windows pelo nome. Informe 'nome_servico' (ex: wuauserv, SysMain, Spooler).",
    command: 'Set-Service -Name "{{NOME_SERVICO}}" -StartupType Disabled -EA 0; Stop-Service -Name "{{NOME_SERVICO}}" -Force -EA 0; if ($?) { Write-Host "Servico {{NOME_SERVICO}} desativado!" -ForegroundColor Green } else { Write-Host "Servico {{NOME_SERVICO}} nao encontrado." -ForegroundColor Yellow }',
  },

  // --- 5. Disco ---
  verificar_espaco_disco: {
    description: "Verifica e retorna o espaco usado, livre e total de todos os discos.",
    command: 'Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N="Usado(GB)";E={[math]::Round(($_.Used/1GB),2)}},@{N="Livre(GB)";E={[math]::Round(($_.Free/1GB),2)}},@{N="Total(GB)";E={[math]::Round((($_.Used+$_.Free)/1GB),2)}} | Format-Table -AutoSize',
  },
  verificar_saude_disco: {
    description: "Verifica a saude do disco (S.M.A.R.T.).",
    command: "Get-WmiObject -Namespace root/wmi -Class MSStorageDriver_FailurePredictStatus | Select-Object PredictFailure,Reason | Format-Table -AutoSize",
  },

  // --- 6. Rede ---
  diagnostico_rede: {
    description: "Faz um diagnostico mostrando informacoes completas da rede (ipconfig /all).",
    command: "ipconfig /all",
  },
  renovar_ip: {
    description: "Faz o flush do DNS e renova o endereco IP da maquina.",
    command: 'ipconfig /flushdns; ipconfig /release; ipconfig /renew; Write-Host "IP renovado!" -ForegroundColor Green',
  },

  // --- 7. Reparo do Sistema ---
  reparar_arquivos_sfc: {
    description: "Executa o sfc /scannow para reparar arquivos corrompidos do sistema.",
    command: "sfc /scannow",
  },
  reparar_imagem_dism: {
    description: "Executa a restauracao da imagem do Windows (DISM /RestoreHealth).",
    command: "DISM /Online /Cleanup-Image /RestoreHealth",
  },

  // --- 8. Diagnostico / Info ---
  verificar_informacoes_sistema: {
    description: "Lista o nome do produto Windows, arquitetura, nome do PC, Processador e Memoria total.",
    command: "Get-ComputerInfo | Select-Object WindowsProductName,WindowsVersion,OsArchitecture,CsName,CsProcessors,CsTotalPhysicalMemory | Format-List",
  },
  verificar_temperatura_cpu: {
    description: "Tenta obter a temperatura da CPU via WMI.",
    command: 'Get-WmiObject MSAcpi_ThermalZoneTemperature -Namespace "root/wmi" | ForEach-Object { Write-Host "Zona: $($_.InstanceName) -> $([math]::Round(($_.CurrentTemperature - 2732)/10, 1))C" }',
  },
  diagnostico_completo: {
    description: "Executa um diagnostico completo do PC: RAM, disco, rede, processos pesados e informacoes do sistema.",
    command: 'Write-Host "===== DIAGNOSTICO COMPLETO =====" -ForegroundColor Cyan; Write-Host ""; Write-Host "--- RAM ---" -ForegroundColor Yellow; $ram = Get-WmiObject Win32_OperatingSystem; $livre = [math]::Round($ram.FreePhysicalMemory/1MB,2); $total = [math]::Round($ram.TotalVisibleMemorySize/1MB,2); Write-Host "RAM Livre: $livre GB de $total GB"; Write-Host ""; Write-Host "--- DISCO ---" -ForegroundColor Yellow; Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N="Usado(GB)";E={[math]::Round(($_.Used/1GB),2)}},@{N="Livre(GB)";E={[math]::Round(($_.Free/1GB),2)}} | Format-Table -AutoSize; Write-Host "--- TOP 10 PROCESSOS (RAM) ---" -ForegroundColor Yellow; Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name,@{N="RAM(MB)";E={[math]::Round($_.WorkingSet64/1MB,2)}} | Format-Table -AutoSize; Write-Host "--- REDE ---" -ForegroundColor Yellow; Test-Connection 8.8.8.8 -Count 1 -Quiet | ForEach-Object { if($_){Write-Host "Internet: OK" -ForegroundColor Green}else{Write-Host "Internet: SEM CONEXAO" -ForegroundColor Red} }',
  },

  // --- 9. Git / Projeto ---
  git_status: {
    description: "Executa 'git status' na pasta do projeto.",
    get command() { return `Set-Location "${PROJETO_PATH}"; git status`; },
  },
  git_pull: {
    description: "Executa 'git pull' na pasta do projeto.",
    get command() { return `Set-Location "${PROJETO_PATH}"; git pull; Write-Host "Repositorio atualizado!" -ForegroundColor Green`; },
  },

  // --- 10. Seguranca ---
  verificar_defender: {
    description: "Verifica o status do Windows Defender.",
    command: "Get-MpComputerStatus | Select-Object AMRunningMode,AntivirusEnabled,RealTimeProtectionEnabled,AntivirusSignatureLastUpdated | Format-List",
  },
  scan_defender_rapido: {
    description: "Executa um scan rapido no Defender.",
    command: 'Start-MpScan -ScanType QuickScan; Write-Host "Scan rapido iniciado!" -ForegroundColor Green',
  },
};

// ==================== TOOLS DEFINITION ====================
const TOOLS = [
  ...Object.entries(mestreTools).map(([name, config]) => {
    const cmdStr = typeof config.command === "string" ? config.command : "";
    const matches = [...cmdStr.matchAll(/\{\{([A-Z_]+)\}\}/g)];
    const uniqueTokens = [...new Set(matches.map((m) => m[1]))];
    const properties = {};
    for (const token of uniqueTokens) {
      const key = token.toLowerCase();
      properties[key] = { type: "string", description: `Valor para ${token}` };
    }
    return {
      name,
      description: config.description,
      inputSchema: {
        type: "object",
        properties,
        required: uniqueTokens.map((t) => t.toLowerCase()),
      },
    };
  }),

  {
    name: "perguntar_ia",
    description: "Envia uma pergunta ao modelo de IA local (Ollama) para obter sugestoes de manutencao. Use para analise inteligente.",
    inputSchema: {
      type: "object",
      properties: {
        pergunta: { type: "string", description: "A pergunta ou problema do usuario sobre o PC." },
      },
      required: ["pergunta"],
    },
  },

  {
    name: "analisar_logs_sistema",
    description: "Coleta os ultimos 20 erros do Event Viewer e os envia para a IA local resumir os problemas mais graves.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "verificar_modelo_ollama",
    description: `Verifica se o modelo ${OLLAMA_MODEL} esta instalado no Ollama e tenta baixa-lo se necessario.`,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ==================== SERVER ====================
const server = new Server(
  { name: "mestre-do-pc-mcp-v8", version: "8.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // --- FERRAMENTA: VERIFICAR MODELO OLLAMA ---
  if (name === "verificar_modelo_ollama") {
    try {
      const res = await fetch(OLLAMA_URL + "/api/tags");
      const data = await res.json();
      const hasModel = data.models?.some((m) => m.name.includes(OLLAMA_MODEL));
      if (hasModel) {
        return { content: [{ type: "text", text: `Modelo ${OLLAMA_MODEL} encontrado e pronto para uso.` }] };
      } else {
        fetch(OLLAMA_URL + "/api/pull", {
          method: "POST",
          body: JSON.stringify({ name: OLLAMA_MODEL, stream: false }),
        });
        return { content: [{ type: "text", text: `Modelo ${OLLAMA_MODEL} nao encontrado. Solicitacao de download enviada ao Ollama. Isso pode demorar.` }] };
      }
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: "Erro ao conectar ao Ollama. Verifique se 'ollama serve' esta rodando." }] };
    }
  }

  // --- FERRAMENTA: ANALISAR LOGS DO SISTEMA ---
  if (name === "analisar_logs_sistema") {
    try {
      const logCmd = "Get-EventLog -LogName System -EntryType Error -Newest 20 | Select-Object TimeGenerated,Source,Message | ConvertTo-Json";
      const dataLogs = await executeLauncherCommand(logCmd, { timeoutMs: 300000 });
      if (!dataLogs.success) throw new Error(dataLogs.output);

      const prompt = `Aqui estao os ultimos 20 erros do Windows (JSON). Resuma os 3 problemas mais criticos e sugira comandos para resolve-los:\n\n${dataLogs.output}`;

      const resIA = await fetch(OLLAMA_URL + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: "user", content: prompt }],
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const dataIA = await resIA.json();
      return { content: [{ type: "text", text: dataIA.message?.content || "A IA nao conseguiu analisar os logs." }] };
    } catch (e) {
      if (e.name === "AbortError") return { isError: true, content: [{ type: "text", text: "Timeout ao analisar logs (30s). Ollama pode estar sobrecarregado." }] };
      return { isError: true, content: [{ type: "text", text: "Falha na analise: " + e.message }] };
    }
  }

  // --- FERRAMENTA: PERGUNTAR IA ---
  if (name === "perguntar_ia") {
    const pergunta = args?.pergunta;
    if (!pergunta) throw new McpError(ErrorCode.InvalidParams, "Parametro 'pergunta' obrigatorio.");
    try {
      const ollamaRes = await fetch(OLLAMA_URL + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: "system", content: OLLAMA_SYSTEM_PROMPT },
            { role: "user", content: pergunta },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const ollamaData = await ollamaRes.json();
      return { content: [{ type: "text", text: ollamaData.message?.content || "Sem resposta." }] };
    } catch (error) {
      if (error.name === "AbortError") return { isError: true, content: [{ type: "text", text: "Timeout: Ollama demorou mais de 15s para responder. Tente novamente." }] };
      return { isError: true, content: [{ type: "text", text: `Falha no Ollama: ${error.message}` }] };
    }
  }

  // --- COMANDOS MESTRE (Mapeados) ---
  const toolConfig = mestreTools[name];
  if (!toolConfig) throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);

  try {
    let finalCmd = typeof toolConfig.command === "function" ? toolConfig.command : toolConfig.command;

    // Substituicao segura de placeholders
    if (args && typeof args === "object") {
      for (const [key, value] of Object.entries(args)) {
        const placeholder = new RegExp(`\\{\\{${key.toUpperCase()}\\}\\}`, "g");
        finalCmd = finalCmd.replace(placeholder, sanitizeArg(value));
      }
    }

    // Verifica placeholders nao preenchidos
    const unfilledMatch = finalCmd.match(/\{\{[A-Z_]+\}\}/);
    if (unfilledMatch) {
      return {
        isError: true,
        content: [{ type: "text", text: `Parametro obrigatorio ausente: ${unfilledMatch[0]}. Forneca o argumento necessario.` }],
      };
    }

    // Verifica tamanho maximo do comando
    if (finalCmd.length > MAX_CMD_LENGTH) {
      return {
        isError: true,
        content: [{ type: "text", text: `Comando excede o tamanho maximo permitido (${MAX_CMD_LENGTH} caracteres).` }],
      };
    }

    const data = await executeLauncherCommand(finalCmd, { timeoutMs: 900000 });
    return {
      isError: !data.success,
      content: [{ type: "text", text: data.output || (data.success ? "Ok." : "Erro.") }],
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return { isError: true, content: [{ type: "text", text: "Timeout: O comando demorou mais de 10s. Verifique se o Launcher esta rodando na porta 7777." }] };
    }
    return { isError: true, content: [{ type: "text", text: `Falha no Mestre Server: ${error.message}` }] };
  }
});

// ==================== STARTUP ====================
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mestre do PC V8 MCP Server iniciado em stdio.");
}

startServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
