/**
 * Tool Registry for MestreDoPC V7
 *
 * Maps tool names to instances. Adding a new tool = import + register here.
 */

import { ITool } from '../../domain/types';
import { LimpezaRapidaCompleta } from './implementations/limpezaRapida';
import { LiberarMemoriaRam } from './implementations/liberarMemoria';
import { AnalizarLogsSistema } from './implementations/analizarLogs';
import { PerguntarIA } from './implementations/perguntarIA';
import { VerificarDisco } from './implementations/verificarDisco';
import { ResetWindowsUpdate } from './implementations/resetWindowsUpdate';

const tools: ITool[] = [
  new LimpezaRapidaCompleta(),
  new LiberarMemoriaRam(),
  new AnalizarLogsSistema(),
  new PerguntarIA(),
  new VerificarDisco(),
  new ResetWindowsUpdate(),
];

const registry = new Map<string, ITool>();
for (const tool of tools) {
  registry.set(tool.name, tool);
}

export function getTool(name: string): ITool | undefined {
  return registry.get(name);
}

export function getAllTools(): ITool[] {
  return Array.from(registry.values());
}

export function getToolNames(): string[] {
  return Array.from(registry.keys());
}
