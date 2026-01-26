/**
 * ARI vNext — Logging Utilities
 *
 * Structured logging using Pino with automatic redaction
 * of sensitive fields and consistent formatting.
 *
 * @module utils/logger
 * @version 1.0.0
 */

import pino from 'pino';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getConfig, getLogsPath } from '../config/config.js';

// ═══════════════════════════════════════════════════════════════════════════
// LOGGER FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createLogger(name: string, options?: { level?: string }): pino.Logger {
  const config = getConfig();

  const opts: pino.LoggerOptions = {
    name,
    level: options?.level ?? config.logging.level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  };

  return pino(opts);
}

export function createFileLogger(name: string, filename: string): pino.Logger {
  const config = getConfig();
  const logsPath = getLogsPath(config);

  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true, mode: 0o700 });
  }

  const logFile = path.join(logsPath, filename);
  const stream = fs.createWriteStream(logFile, { flags: 'a' });

  return pino(
    {
      name,
      level: config.logging.level,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    stream,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRE-CONFIGURED LOGGERS
// ═══════════════════════════════════════════════════════════════════════════

export const logger = createLogger('ari');
export const gatewayLogger = createLogger('ari:gateway');
export const auditLogger = createLogger('ari:audit');
export const securityLogger = createLogger('ari:security');
export const cliLogger = createLogger('ari:cli');

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'key',
  'auth',
  'credential',
  'api_key',
  'apikey',
  'private',
];

export function redact<T extends Record<string, unknown>>(
  obj: T,
  additionalFields: string[] = [],
): T {
  const fieldsToRedact = [...SENSITIVE_FIELDS, ...additionalFields];
  const result = { ...obj };

  for (const key of Object.keys(result)) {
    const lowerKey = key.toLowerCase();
    if (fieldsToRedact.some((field) => lowerKey.includes(field))) {
      result[key as keyof T] = '[REDACTED]' as T[keyof T];
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key as keyof T] = redact(
        result[key] as Record<string, unknown>,
        additionalFields,
      ) as T[keyof T];
    }
  }

  return result;
}

export function formatError(error: unknown): {
  message: string;
  stack?: string;
  code?: string;
  name?: string;
} {
  if (error instanceof Error) {
    const result: { message: string; stack?: string; code?: string; name?: string } = {
      message: error.message,
      name: error.name,
    };
    if (error.stack !== undefined) {
      result.stack = error.stack;
    }
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== undefined) {
      result.code = code;
    }
    return result;
  }

  return { message: String(error) };
}
