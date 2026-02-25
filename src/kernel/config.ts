import { homedir } from 'os';
import fs from 'fs/promises';
import path from 'path';
import { Config, ConfigSchema } from './types.js';

// Configuration directory and file paths
export const CONFIG_DIR = path.join(homedir(), '.ari');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Default configuration
export const DEFAULT_CONFIG: Config = {
  version: '2.1.0',
  auditPath: path.join(CONFIG_DIR, 'audit.json'),
  gatewayPort: 3141,
  trustDefaults: {
    defaultLevel: 'untrusted',
    allowEscalation: false,
  },
};

/**
 * Loads the configuration from CONFIG_PATH.
 * Returns DEFAULT_CONFIG if the file doesn't exist or parsing fails.
 */
export async function loadConfig(): Promise<Config> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    return ConfigSchema.parse(parsed);
  } catch {
    // Return default config if file doesn't exist or parsing fails
    return DEFAULT_CONFIG;
  }
}

/**
 * Saves the configuration to CONFIG_PATH.
 * Validates the config before saving and creates the config directory if needed.
 */
export async function saveConfig(config: Config): Promise<void> {
  // Validate the config before saving
  const validatedConfig = ConfigSchema.parse(config);

  // Ensure the config directory exists
  await fs.mkdir(CONFIG_DIR, { recursive: true });

  // Write the config file with 2-space indentation
  await fs.writeFile(
    CONFIG_PATH,
    JSON.stringify(validatedConfig, null, 2),
    'utf-8'
  );
}

/**
 * Ensures the config directory and required subdirectories exist.
 * Creates ~/.ari/, ~/.ari/audit/, and ~/.ari/logs/ if they don't exist.
 */
export async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.mkdir(path.join(CONFIG_DIR, 'audit'), { recursive: true });
  await fs.mkdir(path.join(CONFIG_DIR, 'logs'), { recursive: true });
}

/**
 * Returns the configuration directory path.
 */
export function getConfigDir(): string {
  return CONFIG_DIR;
}

/**
 * Returns the configuration file path.
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}

/**
 * Validates the format of an LLM API key.
 *
 * ARI uses OpenRouter as the primary LLM gateway (Anthropic ToS Section 3.7
 * prohibits subscription OAuth tokens in automated systems — enforced Feb 2026).
 *
 * Valid formats:
 *   sk_or_*   → OpenRouter API key (preferred — all Claude via OpenRouter)
 *   sk-ant-*  → Anthropic direct API key (fallback)
 *
 * Any other format (including Claude Max OAuth tokens) is PROHIBITED.
 */
export function validateApiKeyFormat(key: string): 'openrouter' | 'anthropic' | 'invalid' {
  if (key.startsWith('sk_or_')) return 'openrouter';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  return 'invalid';
}

/**
 * Asserts that the provided API key has a valid format.
 * Halts with a clear error message if the key is missing or invalid.
 *
 * Call this at startup before any LLM requests are made.
 *
 * @throws {Error} if key is missing or uses a forbidden format
 */
export function assertValidApiKey(key: string | undefined): void {
  if (!key) {
    throw new Error(
      '[ARI Kernel] No API key found. ' +
        'Set OPENROUTER_API_KEY (preferred) or ANTHROPIC_API_KEY.',
    );
  }
  const format = validateApiKeyFormat(key);
  if (format === 'invalid') {
    throw new Error(
      '[ARI Kernel] INVALID API KEY FORMAT — startup aborted. ' +
        'OpenRouter keys start with sk_or_* | Anthropic direct keys start with sk-ant-*. ' +
        'Subscription OAuth tokens are PROHIBITED (Anthropic ToS Section 3.7, Feb 2026). ' +
        'Get a compliant API key at openrouter.ai/keys or console.anthropic.com.',
    );
  }
}
