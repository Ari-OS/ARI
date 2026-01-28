/**
 * DAEMON - macOS launchd Service Manager
 * Manages com.ari.gateway as a LaunchAgent
 */

import { writeFile, unlink, mkdir } from 'fs/promises';
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
}

export interface DaemonStatus {
  installed: boolean;
  running: boolean;
  plistPath: string;
}

export async function installDaemon(options: DaemonOptions = {}): Promise<void> {
  const port = options.port || 3141;
  const logPath = options.logPath || join(homedir(), '.ari', 'logs', 'gateway.log');
  const ariPath = join(homedir(), 'ari');

  // Ensure directories exist
  await mkdir(LAUNCH_AGENTS_DIR, { recursive: true });
  await mkdir(join(homedir(), '.ari', 'logs'), { recursive: true });

  // Find node path safely
  let nodePath: string;
  try {
    const { stdout } = await execFileAsync('which', ['node']);
    nodePath = stdout.trim();
  } catch {
    throw new Error('Node.js not found in PATH');
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
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${logPath}</string>
    <key>StandardErrorPath</key>
    <string>${logPath}</string>
    <key>WorkingDirectory</key>
    <string>${ariPath}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
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
