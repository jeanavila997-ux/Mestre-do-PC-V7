# Integração Multi-LLM — Mestre do PC (MCP Server)

Este documento descreve a arquitetura e o design para permitir que o servidor **Mestre do PC** integre diretamente múltiplos provedores de LLMs (Large Language Models), tanto locais (como Ollama) quanto na nuvem (como OpenAI, Anthropic Claude, Google Gemini e DeepSeek).

---

## 1. Visão Geral da Arquitetura

O servidor MCP do **Mestre do PC** atua como um hub central. Em vez de depender exclusivamente do Launcher PowerShell ou de uma única IA local, o servidor Node.js gerencia as conexões HTTP diretas com as APIs de cada provedor.

```
                  ┌──────────────────────┐
                  │ Assistente (Claude)  │
                  └──────────┬───────────┘
                             │ (Protocolo MCP)
                  ┌──────────▼───────────┐
                  │    MCP Server        │
                  │   Mestre do PC       │
                  └────┬───┬───┬───┬─────┘
                       │   │   │   │
     ┌─────────────────┘   │   │   └───────────────────┐
     │ (HTTP:11434)        │   │                       │ (APIs de Nuvem)
┌────▼────┐                │   │                  ┌────▼────┐
│ Ollama  │                │   └──────────┐       │ OpenAI  │
└─────────┘                │              │       └─────────┘
                      ┌────▼────┐    ┌────▼────┐
                      │ Gemini  │    │ Claude  │
                      └─────────┘    └─────────┘
```

---

## 2. Provedores Suportados e Variáveis de Ambiente

As integrações serão configuradas por meio de variáveis de ambiente. Todas as chaves e provedores são **opcionais**, garantindo o princípio de que o servidor roda no modo Standalone por padrão.

| Provedor | Variável de Ambiente | Modelo Default | Endpoint da API |
| :--- | :--- | :--- | :--- |
| **Ollama** (Local) | Nenhuma (porta 11434 local) | `qwen2.5-coder:1.5b-base` | `http://localhost:11434` |
| **OpenAI** | `OPENAI_API_KEY` | `gpt-4o-mini` | `https://api.openai.com/v1` |
| **Google Gemini** | `GEMINI_API_KEY` | `gemini-1.5-flash` | `https://generativelanguage.googleapis.com` |
| **Anthropic** | `ANTHROPIC_API_KEY` | `claude-3-5-haiku` | `https://api.anthropic.com/v1` |
| **DeepSeek** | `DEEPSEEK_API_KEY` | `deepseek-chat` | `https://api.deepseek.com/v1` |

---

## 3. Extensão da Ferramenta `perguntar_ia`

A ferramenta atual `perguntar_ia` será expandida na whitelist de parâmetros (`src/security/whitelist.ts`) e no gerenciador de rotas para aceitar a seleção dinâmica de provedores e modelos.

### Parâmetros Atualizados do Schema:
* `prompt` (Obrigatório): O texto da pergunta ou comando.
* `provider` (Opcional): Provedor de IA a ser usado. Padrão: `'ollama'`.
  * Valores válidos: `'ollama' | 'openai' | 'gemini' | 'anthropic' | 'deepseek'`
* `model` (Opcional): Nome exato do modelo (ex: `gpt-4o`, `gemini-1.5-pro`).
* `maxTokens` (Opcional): Limite de tokens de resposta.

---

## 4. Estrutura do Módulo de IA (`src/ai/`)

Para manter o código desacoplado e escalável, criaremos um gerenciador de provedores de IA:

### A. Classe Interface Comum (`src/ai/provider.ts`)
```typescript
export interface AIProvider {
  name: string;
  generateResponse(prompt: string, model?: string, maxTokens?: number): Promise<string>;
}
```

### B. Gerenciador de Fábrica (`src/ai/factory.ts`)
```typescript
import { AIProvider } from './provider.js';
import { OllamaProvider } from './providers/ollama.js';
import { OpenAIProvider } from './providers/openai.js';
// ... outros provedores

export function getAIProvider(providerName: string): AIProvider {
  switch (providerName.toLowerCase()) {
    case 'openai':
      return new OpenAIProvider(process.env.OPENAI_API_KEY);
    case 'gemini':
      return new GeminiProvider(process.env.GEMINI_API_KEY);
    case 'anthropic':
      return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    case 'deepseek':
      return new DeepSeekProvider(process.env.DEEPSEEK_API_KEY);
    case 'ollama':
    default:
      return new OllamaProvider();
  }
}
```

---

## 5. Benefícios desta Arquitetura

1. **Robustez Local**: Se o usuário não tiver internet ou chaves de API, o servidor funciona 100% offline via **Ollama**.
2. **Alta Performance**: Para tarefas complexas ou análises de logs que exigem maior inteligência, o usuário pode direcionar para modelos potentes como o GPT-4o ou Claude 3.5 Sonnet.
3. **Sem Carga no Windows**: A integração com APIs de nuvem não consome CPU ou memória RAM do computador local do usuário, tornando-a ideal para máquinas mais leves.
4. **Isolamento de Segurança**: Chaves de API ficam protegidas no ambiente local do servidor MCP (`.env` ou configurações de ambiente do Claude Desktop), nunca expostas ao client direto.
