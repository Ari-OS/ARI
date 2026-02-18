import { describe, it, expect } from 'vitest';
import { execFileNoThrow } from '../../../src/utils/execFileNoThrow.js';

describe('execFileNoThrow', () => {
  it('returns status 0 and stdout on success', async () => {
    const result = await execFileNoThrow('/bin/echo', ['hello world']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.stderr).toBe('');
  });

  it('never throws on command not found', async () => {
    const result = await execFileNoThrow('/bin/this-command-does-not-exist-ari', []);
    expect(result.status).not.toBe(0);
  });

  it('returns non-zero status on failure', async () => {
    const result = await execFileNoThrow('/bin/false', []);
    expect(result.status).not.toBe(0);
  });

  it('captures stderr output', async () => {
    // /bin/sh -c 'echo error >&2; exit 1' — but we use execFile not shell
    // Use ls on a nonexistent path to get stderr output
    const result = await execFileNoThrow('/bin/ls', ['/nonexistent-path-ari-test-12345']);
    expect(result.status).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('respects timeoutMs option', async () => {
    const result = await execFileNoThrow('/bin/sleep', ['10'], { timeoutMs: 100 });
    expect(result.status).not.toBe(0);
  });

  it('passes environment variables', async () => {
    const result = await execFileNoThrow('/usr/bin/env', [], {
      env: { ...process.env, ARI_TEST_VAR: 'ari_value' },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ARI_TEST_VAR=ari_value');
  });

  it('uses working directory option', async () => {
    const result = await execFileNoThrow('/bin/pwd', [], { cwd: '/tmp' });
    expect(result.status).toBe(0);
    // macOS resolves /tmp to /private/tmp via symlink
    expect(result.stdout.trim()).toMatch(/\/tmp$/);
  });
});
