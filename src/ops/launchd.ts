/**
 * ARI vNext — macOS launchd Daemon Management
 *
 * Manages installation and control of ARI as a macOS user-level
 * launch agent for 24/7 always-on operation.
 *
 * @module ops/launchd
 * @version 1.0.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { type Result, ok, err } from '../types/index.js';
import { getConfig, getLogsPath } from '../config/config.js';
import { getAuditLog, systemActor } from '../audit/audit-log.js';
import { logger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SERVICE_LABEL = 'com.ari.vnext';
const PLIST_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = path.join(PLIST_DIR, `${SERVICE_LABEL}.plist`);

// ═══════════════════════════════════════════════════════════════════════════
// PLIST GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generatePlist(): string {
  const config = getConfig();
  const logsPath = getLogsPath(config);
  const nodePath = process.execPath;
  const scriptPath = path.resolve(process.argv[1] ?? '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${scriptPath}</string>
    <string>gateway</string>
    <string>start</string>
    <string>--foreground</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${path.join(logsPath, 'ari-stdout.log')}</string>

  <key>StandardErrorPath</key>
  <string>${path.join(logsPath, 'ari-stderr.log')}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>

  <key>ProcessType</key>
  <string>Background</string>

  <key>LowPriorityIO</key>
  <true/>
</dict>
</plist>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAEMON MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Install the launchd user agent
 */
export async function installDaemon(): Promise<Result<string, Error>> {
  try {
    if (process.platform !== 'darwin') {
      return err(new Error('launchd is only available on macOS'));
    }

    if (!fs.existsSync(PLIST_DIR)) {
      fs.mkdirSync(PLIST_DIR, { recursive: true });
    }

    const config = getConfig();
    const logsPath = getLogsPath(config);
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true, mode: 0o700 });
    }

    const plist = generatePlist();
    fs.writeFileSync(PLIST_PATH, plist, { mode: 0o644, encoding: 'utf-8' });

    try {
      execFileSync('launchctl', ['load', PLIST_PATH], { stdio: 'pipe' });
    } catch {
      // May already be loaded
    }

    const auditLog = getAuditLog();
    await auditLog.initialize();
    await auditLog.append('daemon_installed', systemActor('launchd'), {
      plist_path: PLIST_PATH,
      label: SERVICE_LABEL,
    });

    logger.info({ plistPath: PLIST_PATH }, 'Daemon installed');

    return ok(PLIST_PATH);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Uninstall the launchd user agent
 */
export async function uninstallDaemon(): Promise<Result<void, Error>> {
  try {
    if (process.platform !== 'darwin') {
      return err(new Error('launchd is only available on macOS'));
    }

    try {
      execFileSync('launchctl', ['unload', PLIST_PATH], { stdio: 'pipe' });
    } catch {
      // May not be loaded
    }

    if (fs.existsSync(PLIST_PATH)) {
      fs.unlinkSync(PLIST_PATH);
    }

    const auditLog = getAuditLog();
    await auditLog.initialize();
    await auditLog.append('daemon_uninstalled', systemActor('launchd'), {
      label: SERVICE_LABEL,
    });

    logger.info('Daemon uninstalled');

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Check if the daemon is installed and running
 */
export function getDaemonStatus(): { installed: boolean; running: boolean; pid?: number } {
  if (process.platform !== 'darwin') {
    return { installed: false, running: false };
  }

  const installed = fs.existsSync(PLIST_PATH);

  if (!installed) {
    return { installed: false, running: false };
  }

  try {
    const output = execFileSync('launchctl', ['list', SERVICE_LABEL], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const pidMatch = /^\s*"PID"\s*=\s*(\d+)/m.exec(output);
    const parsedPid = pidMatch ? parseInt(pidMatch[1] ?? '0', 10) : 0;

    if (parsedPid > 0) {
      return { installed: true, running: true, pid: parsedPid };
    }

    return { installed: true, running: false };
  } catch {
    return { installed: true, running: false };
  }
}

/**
 * Restart the daemon
 */
export function restartDaemon(): Result<void, Error> {
  try {
    if (process.platform !== 'darwin') {
      return err(new Error('launchd is only available on macOS'));
    }

    try {
      execFileSync('launchctl', ['unload', PLIST_PATH], { stdio: 'pipe' });
    } catch {
      // May not be loaded
    }

    execFileSync('launchctl', ['load', PLIST_PATH], { stdio: 'pipe' });

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export { SERVICE_LABEL, PLIST_PATH };
