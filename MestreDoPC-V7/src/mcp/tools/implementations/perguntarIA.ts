/**
 * Tool: perguntar_ia
 *
 * Envia uma pergunta para o modelo de IA local (Ollama).
 */

import { BaseTool, ToolResult } from '../base';
import { generate } from '../../../infra/ollama/client';
import { logger } from '../../../infra/logger';

export class PerguntarIA extends BaseTool {
  readonly name = 'perguntar_ia';
  readonly description = 'Envia uma pergunta para o modelo de IA local (Ollama)';
  readonly parameters = [
    { name: 'prompt', type: 'string' as const, required: true, description: 'Texto da pergunta para a IA' },
    { name: 'model', type: 'string' as const, required: false, description: 'Nome do modelo Ollama (default: llama3)' },
    { name: 'maxTokens', type: 'integer' as const, required: false, description: 'Máximo de tokens na resposta' },
  ];

  protected async executeImpl(params: Record<string, string>): Promise<ToolResult> {
    const model = params.model || 'llama3';
    const prompt = params.prompt;
    const maxTokens = params.maxTokens ? parseInt(params.maxTokens, 10) : undefined;

    logger.info({ tool: this.name, model }, 'Querying Ollama');

    const response = await generate({
      model,
      prompt,
      options: {
        num_predict: maxTokens,
        temperature: 0.7,
      },
    });

    return { success: true, data: response.response };
  }
}
