/**
 * execFileNoThrow — safe subprocess wrapper
 *
 * NEVER throws. Returns { stdout, stderr, status } always.
 * Default timeout: 30,000ms. No shell expansion (execFile, not exec).
 */
import { execFile } from 'node:child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  status: number;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

/**
 * Execute a file with arguments — never throws.
 *
 * @param file  - Absolute path or binary name (resolved via PATH)
 * @param args  - Arguments array (no shell interpolation)
 * @param options - Optional settings
 * @returns { stdout, stderr, status } — status 0 = success, N = error code
 */
export function execFileNoThrow(
  file: string,
  args: string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const {
    cwd,
    env,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBuffer = DEFAULT_MAX_BUFFER,
  } = options;

  return new Promise<ExecResult>((resolve) => {
    execFile(
      file,
      args,
      {
        cwd,
        env,
        timeout: timeoutMs,
        maxBuffer,
        windowsHide: true,
      },
      (error, stdoutRaw, stderrRaw) => {
        const outStr = Buffer.isBuffer(stdoutRaw) ? stdoutRaw.toString('utf8') : (stdoutRaw ?? '');
        const errStr = Buffer.isBuffer(stderrRaw) ? stderrRaw.toString('utf8') : (stderrRaw ?? '');

        if (error) {
          const errCode = (error as NodeJS.ErrnoException & { code?: unknown }).code;
          const status = typeof errCode === 'number' ? errCode : (error.killed ? 124 : 1);

          resolve({ stdout: outStr, stderr: errStr, status });
        } else {
          resolve({ stdout: outStr, stderr: errStr, status: 0 });
        }
      },
    );
  });
}
