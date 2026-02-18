/**
 * YouTube CLI Commands
 *
 * youtube:auth  — OAuth2 authorization code flow (Desktop app type)
 *                 Opens browser → catches redirect on loopback → saves refresh token
 * youtube:status — Show current credential configuration
 *
 * ADR-001: Local server binds to 127.0.0.1 only, never 0.0.0.0.
 *
 * Layer: L6 Interfaces (CLI)
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { URL } from 'node:url';
import { Command } from 'commander';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const ENV_PATH = join(homedir(), '.ari', '.env');
const CALLBACK_PATH = '/oauth2/callback';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
].join(' ');

// ─── Token response shape ─────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

// ─── .env helpers ─────────────────────────────────────────────────────────────

function readEnvFile(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};

  const lines = readFileSync(ENV_PATH, 'utf-8').split('\n');
  const env: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }

  return env;
}

function writeEnvFile(env: Record<string, string>): void {
  const existing = readEnvFile();
  const merged = { ...existing, ...env };

  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');
}

// ─── Find an available local port ─────────────────────────────────────────────

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Could not bind to loopback'));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// ─── Run full OAuth2 authorization code flow ──────────────────────────────────

async function runOAuthFlow(clientId: string, clientSecret: string): Promise<string> {
  const port = await findAvailablePort();
  const redirectUri = `http://127.0.0.1:${port}${CALLBACK_PATH}`;
  const state = Math.random().toString(36).slice(2);

  const authUrl = new URL(OAUTH_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', YOUTUBE_SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  console.log('\n  Opening browser for Google authorization...');
  console.log(`  Auth URL: ${authUrl.toString().slice(0, 80)}...`);

  await execFileNoThrow('open', [authUrl.toString()]);

  console.log(`\n  Waiting for Google to redirect to http://127.0.0.1:${port}${CALLBACK_PATH}`);
  console.log('  (Complete authorization in your browser)\n');

  // Wait for the callback
  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth flow timed out after 5 minutes'));
    }, 5 * 60 * 1000);

    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }

      const url = new URL(req.url, `http://127.0.0.1:${port}`);

      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const error = url.searchParams.get('error');
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h2>Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth authorization failed: ${error}`));
        return;
      }

      const returnedState = url.searchParams.get('state');
      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h2>State mismatch — possible CSRF</h2><p>You can close this tab.</p>');
        clearTimeout(timeout);
        server.close();
        reject(new Error('OAuth state mismatch'));
        return;
      }

      const authCode = url.searchParams.get('code');
      if (!authCode) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h2>No authorization code returned</h2><p>You can close this tab.</p>');
        clearTimeout(timeout);
        server.close();
        reject(new Error('No authorization code in callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>ARI — YouTube Authorization</title></head>
          <body style="font-family: system-ui; max-width: 480px; margin: 80px auto; text-align: center;">
            <h2>✅ Authorization successful!</h2>
            <p>ARI has been granted access to your YouTube channel.</p>
            <p><strong>You can close this tab.</strong></p>
          </body>
        </html>
      `);

      clearTimeout(timeout);
      server.close();
      resolve(authCode);
    });

    server.listen(port, '127.0.0.1');
  });

  // Exchange code for tokens
  console.log('  Exchanging authorization code for tokens...');

  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  const tokenData = await tokenRes.json() as TokenResponse;

  if (tokenData.error) {
    throw new Error(`Token exchange failed: ${tokenData.error}: ${tokenData.error_description ?? ''}`);
  }

  if (!tokenData.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. ' +
      'Make sure your OAuth client is Desktop type and you included access_type=offline.',
    );
  }

  return tokenData.refresh_token;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

export function registerYouTubeCommand(program: Command): void {
  const youtube = program
    .command('youtube')
    .description('YouTube integration management');

  // ── youtube auth ─────────────────────────────────────────────────────────────

  youtube
    .command('auth')
    .description('Authorize ARI to upload to YouTube (OAuth2 flow)')
    .option('--client-id <id>', 'Google OAuth client ID (or use YOUTUBE_CLIENT_ID env var)')
    .option('--client-secret <secret>', 'Google OAuth client secret (or use YOUTUBE_CLIENT_SECRET env var)')
    .action(async (options: { clientId?: string; clientSecret?: string }) => {
      const clientId = options.clientId ?? process.env.YOUTUBE_CLIENT_ID;
      const clientSecret = options.clientSecret ?? process.env.YOUTUBE_CLIENT_SECRET;

      if (!clientId) {
        console.error('\n  Error: YOUTUBE_CLIENT_ID not set.');
        console.error('  Set it in ~/.ari/.env or pass --client-id');
        console.error('\n  To get credentials:');
        console.error('  1. Go to console.cloud.google.com');
        console.error('  2. Create a project → Enable YouTube Data API v3');
        console.error('  3. OAuth consent screen → External');
        console.error('  4. Credentials → OAuth 2.0 Client ID → Desktop app');
        console.error('  5. Copy Client ID and Client Secret\n');
        process.exit(1);
      }

      if (!clientSecret) {
        console.error('\n  Error: YOUTUBE_CLIENT_SECRET not set.');
        console.error('  Set it in ~/.ari/.env or pass --client-secret\n');
        process.exit(1);
      }

      try {
        const refreshToken = await runOAuthFlow(clientId, clientSecret);

        writeEnvFile({
          YOUTUBE_CLIENT_ID: clientId,
          YOUTUBE_CLIENT_SECRET: clientSecret,
          YOUTUBE_REFRESH_TOKEN: refreshToken,
        });

        console.log('\n  ✅ YouTube authorization complete!');
        console.log(`  Refresh token saved to ${ENV_PATH}`);
        console.log('\n  ARI can now upload videos to YouTube.');
        console.log('  Run `ari youtube status` to verify.\n');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n  Error: ${msg}\n`);
        process.exit(1);
      }
    });

  // ── youtube status ────────────────────────────────────────────────────────────

  youtube
    .command('status')
    .description('Show YouTube credential configuration status')
    .action(() => {
      const clientId = process.env.YOUTUBE_CLIENT_ID;
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
      const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

      console.log('\n  YouTube Integration Status');
      console.log('  ──────────────────────────');
      console.log(`  Client ID:      ${clientId ? '✅ configured' : '❌ not set (YOUTUBE_CLIENT_ID)'}`);
      console.log(`  Client Secret:  ${clientSecret ? '✅ configured' : '❌ not set (YOUTUBE_CLIENT_SECRET)'}`);
      console.log(`  Refresh Token:  ${refreshToken ? '✅ configured' : '❌ not set — run: ari youtube auth'}`);

      const ready = Boolean(clientId && clientSecret && refreshToken);
      console.log(`\n  Ready to publish: ${ready ? '✅ YES' : '❌ NO'}`);

      if (!ready) {
        console.log('\n  Run `ari youtube auth` to complete authorization.\n');
      } else {
        console.log();
      }
    });
}
