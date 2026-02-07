import { pino } from 'pino';
import type { Logger } from 'pino';

const level = process.env.ARI_LOG_LEVEL ?? 'info';
const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level,
  name: 'ari',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss',
        },
      }
    : undefined,
});

export function createLogger(name: string): Logger {
  return logger.child({ component: name });
}

export default logger;
