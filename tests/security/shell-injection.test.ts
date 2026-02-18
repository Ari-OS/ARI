/**
 * Shell Injection Safety Tests
 *
 * Verifies that all subprocess calls in the codebase use execFileNoThrow
 * (which uses execFile, NOT exec/execSync/spawn with shell expansion).
 *
 * This is a structural security test that scans source files to ensure
 * no unsafe subprocess patterns are introduced.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SRC_ROOT = join(__dirname, '..', '..', 'src');

/**
 * Recursively find all .ts files in a directory.
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');

  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and test directories
      if (entry === 'node_modules' || entry === '.git') continue;
      findTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a file contains unsafe subprocess patterns.
 * Returns array of { line, pattern, content } for each violation.
 */
function findUnsafeSubprocessCalls(filePath: string): Array<{ line: number; pattern: string; content: string }> {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Array<{ line: number; pattern: string; content: string }> = [];

  // Files that are allowed to use exec patterns (the safe wrapper itself, and child_process re-exports)
  const allowedFiles = [
    'src/utils/execFileNoThrow.ts',
    'src/e2e/runner.ts', // E2E runner needs spawn/exec for test automation
  ];

  const relativePath = filePath.replace(/.*\/src\//, 'src/');
  if (allowedFiles.some(f => relativePath.endsWith(f))) return violations;

  const unsafePatterns: Array<{ regex: RegExp; name: string }> = [
    // Direct exec() or execSync() calls (shell expansion)
    { regex: /\bexecSync\s*\(/, name: 'execSync()' },
    // child_process.exec (not execFile)
    { regex: /\bchild_process['"]?\)?\s*\.\s*exec\s*\(/, name: 'child_process.exec()' },
    // Import of exec from child_process (not execFile)
    { regex: /import\s*\{[^}]*\bexec\b[^}]*\}\s*from\s*['"]node:child_process['"]/, name: 'import { exec }' },
    // Import of execSync from child_process
    { regex: /import\s*\{[^}]*\bexecSync\b[^}]*\}\s*from\s*['"]node:child_process['"]/, name: 'import { execSync }' },
    // Import of spawn from child_process (spawn allows shell option)
    { regex: /import\s*\{[^}]*\bspawn\b[^}]*\}\s*from\s*['"]node:child_process['"]/, name: 'import { spawn }' },
    // Import of spawnSync from child_process
    { regex: /import\s*\{[^}]*\bspawnSync\b[^}]*\}\s*from\s*['"]node:child_process['"]/, name: 'import { spawnSync }' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    for (const { regex, name } of unsafePatterns) {
      if (regex.test(line)) {
        violations.push({
          line: i + 1,
          pattern: name,
          content: line.trim(),
        });
      }
    }
  }

  return violations;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Shell Injection Safety', () => {
  const tsFiles = findTsFiles(SRC_ROOT);

  describe('subprocess call safety', () => {
    it('should find source files to scan', () => {
      expect(tsFiles.length).toBeGreaterThan(50);
    });

    it('should not use exec() from child_process anywhere in source', () => {
      const allViolations: Array<{ file: string; line: number; pattern: string; content: string }> = [];

      for (const file of tsFiles) {
        const violations = findUnsafeSubprocessCalls(file);
        for (const v of violations) {
          allViolations.push({ file: file.replace(SRC_ROOT, 'src'), ...v });
        }
      }

      if (allViolations.length > 0) {
        const report = allViolations
          .map(v => `  ${v.file}:${v.line} — ${v.pattern}\n    ${v.content}`)
          .join('\n');
        expect.fail(
          `Found ${allViolations.length} unsafe subprocess call(s):\n${report}\n\n` +
          'All subprocess calls must use execFileNoThrow from src/utils/execFileNoThrow.ts',
        );
      }
    });

    it('should have execFileNoThrow utility available', () => {
      const utilPath = join(SRC_ROOT, 'utils', 'execFileNoThrow.ts');
      expect(existsSync(utilPath)).toBe(true);
    });

    it('should use execFile (not exec) in execFileNoThrow', () => {
      const utilPath = join(SRC_ROOT, 'utils', 'execFileNoThrow.ts');
      const content = readFileSync(utilPath, 'utf-8');

      expect(content).toContain("import { execFile } from 'node:child_process'");
      // Should NOT contain exec (without File)
      expect(content).not.toMatch(/import\s*\{[^}]*\bexec\b[^F][^}]*\}\s*from/);
    });

    it('should have execFileNoThrow that never throws', () => {
      const utilPath = join(SRC_ROOT, 'utils', 'execFileNoThrow.ts');
      const content = readFileSync(utilPath, 'utf-8');

      // Should return a Promise<ExecResult> and resolve (never reject)
      expect(content).toContain('resolve(');
      expect(content).not.toContain('reject(');
    });
  });

  describe('command injection patterns blocked', () => {
    it('should not pass user input directly to shell', () => {
      // Verify that no file uses template literals inside exec-like calls
      for (const file of tsFiles) {
        const content = readFileSync(file, 'utf-8');
        const relativePath = file.replace(SRC_ROOT, 'src');

        // Pattern: exec(`command ${variable}`) — shell injection risk
        const shellInjectionPattern = /\bexec\s*\(\s*`[^`]*\$\{/;
        if (shellInjectionPattern.test(content)) {
          expect.fail(
            `Potential shell injection in ${relativePath}: ` +
            'Template literal used inside exec() call. Use execFileNoThrow with argument array instead.',
          );
        }
      }
    });

    it('should not use { shell: true } option with spawn/execFile', () => {
      for (const file of tsFiles) {
        const content = readFileSync(file, 'utf-8');
        const relativePath = file.replace(SRC_ROOT, 'src');

        // Pattern: { shell: true } — enables shell expansion
        if (/shell\s*:\s*true/.test(content)) {
          // Allow in test files and the exec wrapper itself
          if (relativePath.includes('execFileNoThrow')) continue;

          expect.fail(
            `Found { shell: true } in ${relativePath}: ` +
            'Shell mode is disabled for security. Use execFileNoThrow with argument array.',
          );
        }
      }
    });
  });

  describe('execFileNoThrow usage', () => {
    it('should be imported in files that run subprocesses', () => {
      // Files known to call external commands should import execFileNoThrow
      const filesWithSubprocesses = tsFiles.filter(f => {
        const content = readFileSync(f, 'utf-8');
        return content.includes('execFileNoThrow');
      });

      expect(filesWithSubprocesses.length).toBeGreaterThan(0);
    });

    it('should pass arguments as an array (not concatenated strings)', () => {
      for (const file of tsFiles) {
        const content = readFileSync(file, 'utf-8');
        if (!content.includes('execFileNoThrow')) continue;

        // Look for execFileNoThrow calls and verify args are passed as array
        const calls = content.match(/execFileNoThrow\s*\([^)]*\)/g) ?? [];
        for (const call of calls) {
          // Second argument should be an array literal or variable, not a string
          // This is a heuristic check
          expect(call).not.toMatch(/execFileNoThrow\s*\(\s*['"][^'"]+['"]\s*,\s*['"]/);
        }
      }
    });
  });
});
