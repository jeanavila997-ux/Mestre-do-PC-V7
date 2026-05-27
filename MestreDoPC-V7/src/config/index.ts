/**
 * Centralized Configuration for MestreDoPC V7
 *
 * Single source of truth for all environment variables and defaults.
 * Validates critical settings at startup to fail fast.
 */

export interface Config {
  server: {
    name: string;
    version: string;
  };
  launcher: {
    baseUrl: string;
    defaultTimeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  log: {
    level: string;
  };
  simulation: {
    enabled: boolean;
  };
  ollama: {
    baseUrl: string;
  };
}

function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? defaultValue!;
}

function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer, got: ${value}`);
  }
  return parsed;
}

export const config: Config = {
  server: {
    name: 'mestredopc-v7',
    version: '7.0.0',
  },
  launcher: {
    baseUrl: getEnv('LAUNCHER_URL', 'http://localhost:7777'),
    defaultTimeoutMs: getEnvInt('LAUNCHER_TIMEOUT_MS', 30000),
    maxRetries: getEnvInt('LAUNCHER_MAX_RETRIES', 3),
    retryDelayMs: getEnvInt('LAUNCHER_RETRY_DELAY_MS', 1000),
  },
  log: {
    level: getEnv('LOG_LEVEL', 'info'),
  },
  simulation: {
    enabled: getEnvBool('SIMULATION_MODE', false),
  },
  ollama: {
    baseUrl: getEnv('OLLAMA_URL', 'http://localhost:11434'),
  },
};

export default config;
