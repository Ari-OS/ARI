/**
 * ARI vNext — Configuration Management
 *
 * Handles loading, validation, and path resolution for all configuration.
 * SECURITY: bind_loopback_only is ALWAYS true regardless of config file.
 *
 * @module config
 * @version 1.0.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { type Config, ConfigSchema, type Result, ok, err } from '../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_BASE_DIR = path.join(os.homedir(), '.ari');

export const DEFAULT_CONFIG: Config = {
  gateway: {
    host: '127.0.0.1',
    port: 18789,
    max_connections: 100,
    heartbeat_interval_ms: 30000,
  },
  limits: {
    max_message_bytes: 65536,
    per_sender_per_minute: 10,
    max_attachments: 10,
    max_attachment_size_bytes: 10485760,
  },
  paths: {
    base_dir: DEFAULT_BASE_DIR,
    audit_file: 'audit.jsonl',
    pid_file: 'ari.pid',
    log_dir: 'logs',
    config_file: 'config.json',
  },
  logging: {
    level: 'info',
    pretty: false,
  },
  security: {
    bind_loopback_only: true,
    require_auth: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function expandPath(inputPath: string): string {
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  if (inputPath === '~') {
    return os.homedir();
  }
  return inputPath;
}

export function getBaseDir(config?: Partial<Config>): string {
  return expandPath(config?.paths?.base_dir ?? DEFAULT_CONFIG.paths.base_dir);
}

export function getPath(relativePath: string, config?: Partial<Config>): string {
  return path.join(getBaseDir(config), relativePath);
}

export function getAuditPath(config?: Partial<Config>): string {
  return getPath(config?.paths?.audit_file ?? DEFAULT_CONFIG.paths.audit_file, config);
}

export function getPidPath(config?: Partial<Config>): string {
  return getPath(config?.paths?.pid_file ?? DEFAULT_CONFIG.paths.pid_file, config);
}

export function getLogsPath(config?: Partial<Config>): string {
  return getPath(config?.paths?.log_dir ?? DEFAULT_CONFIG.paths.log_dir, config);
}

export function getConfigPath(config?: Partial<Config>): string {
  return getPath(config?.paths?.config_file ?? DEFAULT_CONFIG.paths.config_file, config);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTORY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export function ensureDirectories(config?: Partial<Config>): Result<void, Error> {
  try {
    const baseDir = getBaseDir(config);
    const logsDir = getLogsPath(config);

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
    }

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true, mode: 0o700 });
    }

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function checkDirectoryAccess(config?: Partial<Config>): Result<void, Error> {
  try {
    const baseDir = getBaseDir(config);

    if (!fs.existsSync(baseDir)) {
      return err(new Error(`Base directory does not exist: ${baseDir}`));
    }

    const testFile = path.join(baseDir, `.write-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'test', { mode: 0o600 });
    fs.unlinkSync(testFile);

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION LOADING
// ═══════════════════════════════════════════════════════════════════════════

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Partial<Record<string, unknown>>,
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Load configuration from file, merge with defaults.
 * SECURITY: bind_loopback_only is ALWAYS enforced as true.
 */
export function loadConfig(customPath?: string): Result<Config, Error> {
  try {
    const configPath = customPath ?? getConfigPath();
    const expandedPath = expandPath(configPath);

    let userConfig: Partial<Config> = {};

    if (fs.existsSync(expandedPath)) {
      const content = fs.readFileSync(expandedPath, 'utf-8');
      userConfig = JSON.parse(content) as Partial<Config>;
    }

    const merged = deepMerge(DEFAULT_CONFIG, userConfig);

    // SECURITY ENFORCEMENT: bind_loopback_only is ALWAYS true
    merged.security.bind_loopback_only = true;

    const result = ConfigSchema.safeParse(merged);
    if (!result.success) {
      return err(new Error(`Invalid configuration: ${result.error.message}`));
    }

    return ok(result.data);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function saveConfig(config: Config, customPath?: string): Result<void, Error> {
  try {
    const configPath = customPath ?? getConfigPath(config);
    const expandedPath = expandPath(configPath);
    const dir = path.dirname(expandedPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    fs.writeFileSync(expandedPath, JSON.stringify(config, null, 2), {
      mode: 0o600,
      encoding: 'utf-8',
    });

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function ensureConfig(): Result<Config, Error> {
  const dirResult = ensureDirectories();
  if (!dirResult.success) {
    return err(dirResult.error);
  }

  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    const saveResult = saveConfig(DEFAULT_CONFIG);
    if (!saveResult.success) {
      return err(saveResult.error);
    }
  }

  return loadConfig();
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON PATTERN
// ═══════════════════════════════════════════════════════════════════════════

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig === null) {
    const result = loadConfig();
    cachedConfig = result.success ? result.data : DEFAULT_CONFIG;
  }
  return cachedConfig;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

export function reloadConfig(): Result<Config, Error> {
  clearConfigCache();
  const result = loadConfig();
  if (result.success) {
    cachedConfig = result.data;
  }
  return result;
}
