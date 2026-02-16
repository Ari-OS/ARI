/**
 * ARI Ollama Integration Client
 *
 * Provides local LLM capabilities for privacy-sensitive tasks, classification,
 * and embeddings via the Ollama API.
 *
 * Security: Enforces loopback-only base URL (127.0.0.1) per ARI's security invariants.
 * No authentication required for local Ollama instances.
 *
 * API Reference: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import { createLogger } from '../../kernel/logger.js';

const logger = createLogger('ollama-client');

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_CLASSIFY_MODEL = 'llama3.2:3b';
const DEFAULT_SUMMARIZE_MODEL = 'llama3.2:3b';

export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  digest: string;
  parameterSize: string;
  quantizationLevel: string;
}

export interface GenerateOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  system?: string;
  stream?: boolean;
}

export interface GenerateResult {
  response: string;
  model: string;
  totalDuration: number;
  promptEvalCount: number;
  evalCount: number;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Ollama API client for local LLM operations
 */
export class OllamaClient {
  private baseUrl: string;

  /**
   * Create a new Ollama client
   *
   * @param baseUrl - Base URL for Ollama API (defaults to http://127.0.0.1:11434)
   */
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? DEFAULT_BASE_URL;

    // Security: Enforce loopback-only per ARI's security invariants
    if (!this.baseUrl.includes('127.0.0.1') && !this.baseUrl.includes('localhost')) {
      logger.warn('Ollama base URL is not loopback-only; ARI security policy prefers 127.0.0.1');
    }

    logger.info('Ollama client initialized', { baseUrl: this.baseUrl });
  }

  /**
   * Generate text completion
   *
   * @param model - Model name (e.g., 'llama3.2:3b')
   * @param prompt - Text prompt
   * @param options - Generation options
   * @returns Generation result
   */
  async generate(
    model: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    try {
      const url = `${this.baseUrl}/api/generate`;
      const body: Record<string, unknown> = {
        model,
        prompt,
        stream: false,
      };

      if (options?.system) {
        body.system = options.system;
      }

      if (options?.temperature !== undefined) {
        body.options = {
          ...(body.options as Record<string, unknown> | undefined),
          temperature: options.temperature,
        };
      }

      if (options?.topP !== undefined) {
        body.options = {
          ...(body.options as Record<string, unknown> | undefined),
          top_p: options.topP,
        };
      }

      if (options?.maxTokens !== undefined) {
        body.options = {
          ...(body.options as Record<string, unknown> | undefined),
          num_predict: options.maxTokens,
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        response: string;
        model: string;
        total_duration?: number;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        response: data.response,
        model: data.model,
        totalDuration: data.total_duration ?? 0,
        promptEvalCount: data.prompt_eval_count ?? 0,
        evalCount: data.eval_count ?? 0,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ollama generate failed', { error: msg, model, promptLength: prompt.length });
      throw new Error(`Ollama generate failed: ${msg}`);
    }
  }

  /**
   * Chat completion with message history
   *
   * @param model - Model name
   * @param messages - Array of chat messages
   * @param options - Generation options
   * @returns Generation result
   */
  async chat(
    model: string,
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    try {
      const url = `${this.baseUrl}/api/chat`;
      const body: Record<string, unknown> = {
        model,
        messages,
        stream: false,
      };

      if (options?.temperature !== undefined) {
        body.options = {
          ...(body.options as Record<string, unknown> | undefined),
          temperature: options.temperature,
        };
      }

      if (options?.topP !== undefined) {
        body.options = {
          ...(body.options as Record<string, unknown> | undefined),
          top_p: options.topP,
        };
      }

      if (options?.maxTokens !== undefined) {
        body.options = {
          ...(body.options as Record<string, unknown> | undefined),
          num_predict: options.maxTokens,
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        message: { content: string };
        model: string;
        total_duration?: number;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        response: data.message.content,
        model: data.model,
        totalDuration: data.total_duration ?? 0,
        promptEvalCount: data.prompt_eval_count ?? 0,
        evalCount: data.eval_count ?? 0,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ollama chat failed', { error: msg, model, messageCount: messages.length });
      throw new Error(`Ollama chat failed: ${msg}`);
    }
  }

  /**
   * Generate embeddings for text
   *
   * @param model - Model name (e.g., 'nomic-embed-text')
   * @param text - Text to embed
   * @returns Embedding result
   */
  async embed(model: string, text: string): Promise<EmbeddingResult> {
    try {
      const url = `${this.baseUrl}/api/embed`;
      const body = {
        model,
        input: text,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        embeddings: number[][];
        model: string;
      };

      return {
        embedding: data.embeddings[0] ?? [],
        model: data.model,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ollama embed failed', { error: msg, model, textLength: text.length });
      throw new Error(`Ollama embed failed: ${msg}`);
    }
  }

  /**
   * List available models
   *
   * @returns Array of available models
   */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const url = `${this.baseUrl}/api/tags`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        models: Array<{
          name: string;
          modified_at: string;
          size: number;
          digest: string;
          details?: {
            parameter_size?: string;
            quantization_level?: string;
          };
        }>;
      };

      return data.models.map((model) => ({
        name: model.name,
        modifiedAt: model.modified_at,
        size: model.size,
        digest: model.digest,
        parameterSize: model.details?.parameter_size ?? 'unknown',
        quantizationLevel: model.details?.quantization_level ?? 'unknown',
      }));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ollama listModels failed', { error: msg });
      throw new Error(`Ollama listModels failed: ${msg}`);
    }
  }

  /**
   * Check if Ollama is available
   *
   * @returns True if Ollama is reachable, false otherwise
   */
  async isAvailable(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/tags`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      return response.ok;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.debug('Ollama not available', { error: msg });
      return false;
    }
  }

  /**
   * Classify text into one of the provided categories
   *
   * @param text - Text to classify
   * @param categories - Array of category names
   * @param model - Model to use (defaults to llama3.2:3b)
   * @returns Classification result with category and confidence
   */
  async classify(
    text: string,
    categories: string[],
    model?: string
  ): Promise<{ category: string; confidence: number }> {
    const modelName = model ?? DEFAULT_CLASSIFY_MODEL;

    try {
      const categoryList = categories.map((cat, i) => `${i + 1}. ${cat}`).join('\n');
      const prompt = `Classify the following text into one of these categories:

${categoryList}

Text: ${text}

Respond with ONLY the category number (e.g., "1" or "2"). Do not include any explanation.`;

      const result = await this.generate(modelName, prompt, {
        temperature: 0.1, // Low temperature for deterministic classification
        maxTokens: 10,
      });

      // Extract the number from the response
      const match = result.response.match(/\d+/);
      if (!match) {
        logger.warn('Ollama classification returned no number', { response: result.response });
        return { category: categories[0] ?? 'unknown', confidence: 0.5 };
      }

      const categoryIndex = parseInt(match[0], 10) - 1;
      if (categoryIndex < 0 || categoryIndex >= categories.length) {
        logger.warn('Ollama classification returned invalid category index', {
          index: categoryIndex,
          categoriesCount: categories.length,
        });
        return { category: categories[0] ?? 'unknown', confidence: 0.5 };
      }

      // Simple confidence heuristic: higher if response is clean
      const confidence = result.response.trim() === match[0] ? 0.9 : 0.7;

      return {
        category: categories[categoryIndex] ?? 'unknown',
        confidence,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ollama classification failed', { error: msg, model: modelName });
      throw new Error(`Ollama classification failed: ${msg}`);
    }
  }

  /**
   * Summarize text
   *
   * @param text - Text to summarize
   * @param maxLength - Maximum summary length in words (defaults to 100)
   * @param model - Model to use (defaults to llama3.2:3b)
   * @returns Summary text
   */
  async summarize(text: string, maxLength?: number, model?: string): Promise<string> {
    const modelName = model ?? DEFAULT_SUMMARIZE_MODEL;
    const maxWords = maxLength ?? 100;

    try {
      const prompt = `Summarize the following text in ${maxWords} words or less:

${text}

Summary:`;

      const result = await this.generate(modelName, prompt, {
        temperature: 0.3,
        maxTokens: Math.ceil(maxWords * 1.5), // Rough token estimate
      });

      return result.response.trim();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ollama summarization failed', { error: msg, model: modelName });
      throw new Error(`Ollama summarization failed: ${msg}`);
    }
  }
}
