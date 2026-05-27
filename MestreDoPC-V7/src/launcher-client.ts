/**
 * Launcher Client for MestreDoPC V7
 *
 * Executes PowerShell commands directly via child_process — sem dependência de
 * servidor externo ou aplicativo separado.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { encodeCommand, detectInjection } from './security/sanitizer';
import { validateToolParams } from './security/whitelist';

const execFileAsync = promisify(execFile);

type ScriptBuilder = (params: Record<string, string>) => string;

const TOOL_SCRIPTS: Record<string, ScriptBuilder> = {
  limpeza_rapida_completa: (params) => {
    const dryRun = params.dryRun === 'true' ? '$true' : '$false';
    return `$dryRun = ${dryRun}
$tempPath = $env:TEMP
$tempFiles = @(Get-ChildItem -Path $tempPath -Recurse -ErrorAction SilentlyContinue)
if (-not $dryRun) {
  Remove-Item -Path "$tempPath\\*" -Recurse -Force -ErrorAction SilentlyContinue
  Clear-RecycleBin -Force -ErrorAction SilentlyContinue
}
@{ arquivos_temp_encontrados = $tempFiles.Count; simulacao = $dryRun; status = 'concluido' } | ConvertTo-Json`;
  },

  liberar_memoria_ram: (_params) => `$before = [Math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024, 0)
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()
$after = [Math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024, 0)
@{ ram_livre_antes_MB = $before; ram_livre_depois_MB = $after; liberado_MB = ($after - $before); status = 'concluido' } | ConvertTo-Json`,

  analizar_logs_sistema: (params) => {
    const logName = params.logName || 'System';
    const entryType = params.entryType || 'Error';
    const hours = parseInt(params.hours || '24', 10);
    return `$depois = (Get-Date).AddHours(-${hours})
$eventos = Get-EventLog -LogName '${logName}' -EntryType ${entryType} -After $depois -Newest 50 -ErrorAction SilentlyContinue
if ($null -eq $eventos) { '{"eventos":[],"total":0,"status":"ok"}' } else {
  @{
    eventos = @($eventos | Select-Object TimeGenerated, EntryType, Source, @{n='Mensagem';e={$_.Message.Substring(0,[Math]::Min(300,$_.Message.Length))}})
    total = @($eventos).Count
    status = 'ok'
  } | ConvertTo-Json -Depth 4
}`;
  },

  perguntar_ia: (params) => {
    const model = params.model || 'qwen2.5:3b';
    const maxTokens = params.maxTokens || '512';
    const escapedPrompt = (params.prompt || '').replace(/'/g, "''");
    return `$body = @{ model = '${model}'; prompt = '${escapedPrompt}'; stream = $false; options = @{ num_predict = ${maxTokens} } } | ConvertTo-Json -Compress
try {
  $r = Invoke-RestMethod -Uri 'http://localhost:11434/api/generate' -Method POST -Body $body -ContentType 'application/json; charset=utf-8' -TimeoutSec 120
  @{ resposta = $r.response; model = '${model}'; status = 'ok' } | ConvertTo-Json
} catch {
  @{ erro = $_.Exception.Message; dica = 'Certifique-se de que o Ollama esta rodando: ollama serve'; status = 'falha' } | ConvertTo-Json
}`;
  },

  verificar_disco: (params) => {
    const drive = (params.driveLetter || 'C').replace(/[^A-Z]/g, '');
    return `$vol = Get-Volume -DriveLetter '${drive}' -ErrorAction SilentlyContinue
if ($vol) {
  @{
    letra = $vol.DriveLetter
    tamanho_GB = [Math]::Round($vol.Size / 1GB, 2)
    livre_GB = [Math]::Round($vol.SizeRemaining / 1GB, 2)
    usado_GB = [Math]::Round(($vol.Size - $vol.SizeRemaining) / 1GB, 2)
    percentual_livre = [Math]::Round(($vol.SizeRemaining / $vol.Size) * 100, 1)
    saude = $vol.HealthStatus
    sistema_arquivo = $vol.FileSystemType
    status = 'ok'
  } | ConvertTo-Json
} else {
  @{ erro = 'Drive ${drive}: nao encontrado'; status = 'falha' } | ConvertTo-Json
}`;
  },

  reset_windows_update: (_params) => `try {
  Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
  Stop-Service -Name bits -Force -ErrorAction SilentlyContinue
  Stop-Service -Name cryptsvc -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
  Start-Service -Name cryptsvc -ErrorAction SilentlyContinue
  Start-Service -Name bits -ErrorAction SilentlyContinue
  Start-Service -Name wuauserv -ErrorAction SilentlyContinue
  @{ mensagem = 'Windows Update reiniciado com sucesso'; status = 'ok' } | ConvertTo-Json
} catch {
  @{ erro = $_.Exception.Message; status = 'falha' } | ConvertTo-Json
}`,
};

export async function executeLauncherCommand(
  toolName: string,
  params: Record<string, string>
): Promise<unknown> {
  const requestLogger = logger.child({ toolName, params: Object.keys(params) });
  const executionStart = Date.now();

  const validation = validateToolParams(toolName, params);
  if (!validation.isValid) {
    requestLogger.warn({ errors: validation.errors }, 'Invalid parameters');
    throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
  }

  for (const [key, value] of Object.entries(params)) {
    if (detectInjection(value)) {
      requestLogger.error({ param: key }, 'Potential injection detected');
      throw new Error(`Security violation: potential command injection in parameter '${key}'`);
    }
  }

  const scriptFn = TOOL_SCRIPTS[toolName];
  if (!scriptFn) {
    throw new Error(`No implementation for tool: ${toolName}`);
  }

  if (process.env.SIMULATION_MODE === 'true') {
    requestLogger.info({ totalDurationMs: Date.now() - executionStart }, 'Simulation mode - command not executed');
    return { simulated: true, tool: toolName, message: 'Command would be executed in simulation mode' };
  }

  const psScript = scriptFn(params);
  const encoded = encodeCommand(psScript);

  const timeoutMs = parseInt(process.env.LAUNCHER_TIMEOUT || '30000', 10);
  const maxAttempts = parseInt(process.env.LAUNCHER_RETRIES || '3', 10);
  let attempt = 1;
  let delay = 1000;

  while (attempt <= maxAttempts) {
    const attemptStart = Date.now();
    requestLogger.info({ attempt, maxAttempts, timeoutMs }, 'Executing PowerShell command directly');

    try {
      const { stdout, stderr } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', encoded],
        { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 }
      );

      if (stderr) {
        requestLogger.warn({ stderr: stderr.substring(0, 500) }, 'PowerShell stderr');
      }

      const output = stdout.trim();
      let result;
      try {
        result = JSON.parse(output);
      } catch {
        result = { saida: output, status: 'ok' };
      }

      requestLogger.info(
        {
          success: true,
          attempt,
          attemptDurationMs: Date.now() - attemptStart,
          totalDurationMs: Date.now() - executionStart,
        },
        'Tool execution finished'
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      requestLogger.warn(
        {
          error: errorMessage,
          attempt,
          attemptDurationMs: Date.now() - attemptStart,
          willRetry: attempt < maxAttempts,
        },
        'PowerShell execution attempt failed'
      );

      if (attempt === maxAttempts) {
        requestLogger.error(
          { error: errorMessage, totalDurationMs: Date.now() - executionStart },
          'All PowerShell execution attempts failed'
        );
        throw new Error(`PowerShell execution failed: ${errorMessage}`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
      attempt++;
    }
  }

  throw new Error('Unreachable: executeLauncherCommand loop exhausted without return or throw');
}
