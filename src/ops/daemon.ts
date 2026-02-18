/**
 * DAEMON - macOS launchd Service Manager
 * Manages com.ari.gateway as a LaunchAgent
 */

import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PLIST_NAME = 'com.ari.gateway';
const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, `${PLIST_NAME}.plist`);

export interface DaemonOptions {
  port?: number;
  logPath?: string;
  ariPath?: string;
  production?: boolean;  // Enable production optimizations for Mac Mini M4
}

export interface DaemonStatus {
  installed: boolean;
  running: boolean;
  plistPath: string;
}

export interface LogPaths {
  stdout: string;
  stderr: string;
}

export async function installDaemon(options: DaemonOptions = {}): Promise<void> {
  const port = options.port || 3141;
  const logDir = join(homedir(), '.ari', 'logs');
  const stdoutLog = join(logDir, 'gateway-stdout.log');
  const stderrLog = join(logDir, 'gateway-stderr.log');
  const ariPath = options.ariPath || process.cwd();
  const isProduction = options.production || false;

  // Ensure directories exist
  await mkdir(LAUNCH_AGENTS_DIR, { recursive: true });
  await mkdir(logDir, { recursive: true });

  // Find node path safely
  let nodePath: string;
  try {
    const { stdout } = await execFileAsync('which', ['node']);
    nodePath = stdout.trim();
  } catch {
    throw new Error('Node.js not found in PATH');
  }

  // Production-specific configurations for Mac Mini M4 (24GB RAM)
  const resourceLimits = isProduction
    ? `
    <key>SoftResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>4096</integer>
        <key>NumberOfProcesses</key>
        <integer>2048</integer>
    </dict>
    <key>HardResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>8192</integer>
    </dict>
    <key>ExitTimeOut</key>
    <integer>30</integer>`
    : '';

  const nodeOptions = isProduction
    ? `
        <key>NODE_OPTIONS</key>
        <string>--max-old-space-size=4096</string>`
    : '';

  // Load env vars from ~/.ari/.env and inject into plist
  const envVarsToInject = [
    // Core
    'ANTHROPIC_API_KEY', 'ARI_API_KEY',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_OWNER_USER_ID', 'TELEGRAM_ALLOWED_USER_IDS',

    // AI Providers
    'OPENAI_API_KEY', 'GOOGLE_AI_API_KEY', 'XAI_API_KEY',

    // Notion
    'NOTION_API_KEY', 'NOTION_INBOX_DATABASE_ID', 'NOTION_DAILY_LOG_PARENT_ID', 'NOTION_TASKS_DATABASE_ID',

    // X/Twitter (read + write)
    'X_BEARER_TOKEN', 'X_USER_ID',
    'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET',

    // Market
    'ALPHA_VANTAGE_API_KEY', 'COINGECKO_API_KEY',

    // Media
    'ELEVENLABS_API_KEY',

    // Integrations
    'GITHUB_TOKEN',
    'WEATHER_API_KEY', 'WEATHER_LOCATION',
    'PERPLEXITY_API_KEY',
    'HEYGEN_API_KEY',
    'GMAIL_EMAIL', 'GMAIL_APP_PASSWORD',

    // Readwise & Toggl
    'READWISE_TOKEN', 'TOGGL_API_TOKEN',

    // Settings
    'ARI_LOG_LEVEL', 'NODE_ENV',
  ];
  let envPlistEntries = '';
  try {
    const envContent = await readFile(join(homedir(), '.ari', '.env'), 'utf-8');
    for (const key of envVarsToInject) {
      const match = envContent.match(new RegExp(`^(?:export\\s+)?${key}=["']?(.+?)["']?$`, 'm'));
      if (match?.[1]) {
        const value = match[1].trim();
        envPlistEntries += `
        <key>${key}</key>
        <string>${value}</string>`;
      }
    }
  } catch {
    // .env not found — will rely on dotenv at runtime
  }

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${ariPath}/dist/cli/index.js</string>
        <string>gateway</string>
        <string>start</string>
        <string>--port</string>
        <string>${port}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${ariPath}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>ProcessType</key>
    <string>Background</string>
    <key>StandardOutPath</key>
    <string>${stdoutLog}</string>
    <key>StandardErrorPath</key>
    <string>${stderrLog}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>NODE_ENV</key>
        <string>production</string>${nodeOptions}${envPlistEntries}
    </dict>${resourceLimits}
</dict>
</plist>`;

  await writeFile(PLIST_PATH, plist, 'utf-8');

  try {
    await execFileAsync('launchctl', ['load', PLIST_PATH]);
  } catch (error) {
    throw new Error(`Failed to load daemon: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function uninstallDaemon(): Promise<void> {
  try {
    await execFileAsync('launchctl', ['unload', PLIST_PATH]);
  } catch {
    // May not be loaded — that's fine
  }

  if (existsSync(PLIST_PATH)) {
    await unlink(PLIST_PATH);
  }
}

export async function getDaemonStatus(): Promise<DaemonStatus> {
  const installed = existsSync(PLIST_PATH);
  let running = false;

  if (installed) {
    try {
      const { stdout } = await execFileAsync('launchctl', ['list']);
      running = stdout.includes(PLIST_NAME);
    } catch {
      running = false;
    }
  }

  return { installed, running, plistPath: PLIST_PATH };
}

export function getLogPaths(): LogPaths {
  const logDir = join(homedir(), '.ari', 'logs');
  return {
    stdout: join(logDir, 'gateway-stdout.log'),
    stderr: join(logDir, 'gateway-stderr.log'),
  };
}
