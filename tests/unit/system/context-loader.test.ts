import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextLoader } from '../../../src/system/context-loader.js';
import { EventBus } from '../../../src/kernel/event-bus.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('ContextLoader', () => {
  let loader: ContextLoader;
  let eventBus: EventBus;
  let testDir: string;

  beforeEach(async () => {
    eventBus = new EventBus();

    // Create a temp directory structure for tests
    testDir = path.join(os.tmpdir(), `ari-context-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    loader = new ContextLoader(eventBus, { projectRoot: testDir });
  });

  afterEach(async () => {
    loader.clearCache();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadForDirectory', () => {
    it('should load context from current directory', async () => {
      // Create CLAUDE.md in test directory
      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        '# Test Context\n\nThis is test context.'
      );

      const contexts = await loader.loadForDirectory(testDir);
      expect(contexts.length).toBe(1);
      expect(contexts[0].content).toContain('Test Context');
    });

    it('should walk up directory tree', async () => {
      // Create nested structure
      const subDir = path.join(testDir, 'src', 'agents');
      await fs.mkdir(subDir, { recursive: true });

      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        '# Root Context'
      );

      await fs.writeFile(
        path.join(testDir, 'src', 'CLAUDE.md'),
        '# Src Context'
      );

      await fs.writeFile(
        path.join(subDir, 'CLAUDE.md'),
        '# Agents Context'
      );

      const contexts = await loader.loadForDirectory(subDir);
      expect(contexts.length).toBe(3);

      // Should be ordered closest first
      expect(contexts[0].content).toContain('Agents Context');
      expect(contexts[1].content).toContain('Src Context');
      expect(contexts[2].content).toContain('Root Context');
    });

    it('should cache results', async () => {
      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        '# Cached Context'
      );

      const contexts1 = await loader.loadForDirectory(testDir);
      const contexts2 = await loader.loadForDirectory(testDir);

      expect(contexts1).toBe(contexts2); // Same reference (cached)
    });

    it('should clear cache', async () => {
      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        '# Original'
      );

      const contexts1 = await loader.loadForDirectory(testDir);

      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        '# Updated'
      );

      loader.clearCache();
      const contexts2 = await loader.loadForDirectory(testDir);

      expect(contexts1[0].content).toContain('Original');
      expect(contexts2[0].content).toContain('Updated');
    });
  });

  describe('getContextualSkills', () => {
    it('should extract skill references', async () => {
      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        `# Context with Skills

Use skill: ari-testing
Also use /ari-deploy and /ari-secure commands.
`
      );

      const skills = await loader.getContextualSkills(testDir);
      expect(skills).toContain('ari-testing');
      expect(skills).toContain('ari-deploy');
      expect(skills).toContain('ari-secure');
    });

    it('should deduplicate skills', async () => {
      await fs.writeFile(
        path.join(testDir, 'CLAUDE.md'),
        'Use /ari-test and /ari-test and /ari-test'
      );

      const skills = await loader.getContextualSkills(testDir);
      const uniqueSkills = [...new Set(skills)];
      expect(skills.length).toBe(uniqueSkills.length);
    });
  });

  describe('getCombinedContext', () => {
    it('should combine contexts with separator', async () => {
      const subDir = path.join(testDir, 'sub');
      await fs.mkdir(subDir);

      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Root');
      await fs.writeFile(path.join(subDir, 'CLAUDE.md'), '# Sub');

      const combined = await loader.getCombinedContext(subDir);
      expect(combined).toContain('# Root');
      expect(combined).toContain('# Sub');
      expect(combined).toContain('---');
    });

    it('should include headers when requested', async () => {
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Test');

      const combined = await loader.getCombinedContext(testDir, {
        includeHeaders: true,
      });

      expect(combined).toContain('<!-- From:');
    });
  });

  describe('findClosestContext', () => {
    it('should find closest context for file', async () => {
      const subDir = path.join(testDir, 'src');
      await fs.mkdir(subDir);

      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Root');
      await fs.writeFile(path.join(subDir, 'CLAUDE.md'), '# Src');

      const filePath = path.join(subDir, 'index.ts');
      const context = await loader.findClosestContext(filePath);

      expect(context).toBeDefined();
      expect(context?.content).toContain('# Src');
    });
  });

  describe('hasContext', () => {
    it('should return true when context exists', async () => {
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Test');

      const hasCtx = await loader.hasContext(testDir);
      expect(hasCtx).toBe(true);
    });

    it('should return false when no context', async () => {
      const emptyDir = path.join(testDir, 'empty');
      await fs.mkdir(emptyDir);

      const hasCtx = await loader.hasContext(emptyDir);
      expect(hasCtx).toBe(false);
    });
  });

  describe('listAllContextFiles', () => {
    it('should list all CLAUDE.md files', async () => {
      await fs.mkdir(path.join(testDir, 'src', 'kernel'), { recursive: true });
      await fs.mkdir(path.join(testDir, 'src', 'agents'), { recursive: true });

      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Root');
      await fs.writeFile(path.join(testDir, 'src', 'CLAUDE.md'), '# Src');
      await fs.writeFile(path.join(testDir, 'src', 'kernel', 'CLAUDE.md'), '# Kernel');

      const files = await loader.listAllContextFiles();
      expect(files.length).toBe(3);
    });

    it('should skip node_modules', async () => {
      await fs.mkdir(path.join(testDir, 'node_modules', 'some-pkg'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Root');
      await fs.writeFile(path.join(testDir, 'node_modules', 'some-pkg', 'CLAUDE.md'), '# Skip');

      const files = await loader.listAllContextFiles();
      expect(files.length).toBe(1);
      expect(files[0]).not.toContain('node_modules');
    });
  });

  describe('events', () => {
    it('should emit context:loaded event', async () => {
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Test');

      let emittedEvent: unknown;
      eventBus.on('context:loaded', (payload) => {
        emittedEvent = payload;
      });

      await loader.loadForDirectory(testDir);

      expect(emittedEvent).toBeDefined();
      expect((emittedEvent as { path: string }).path).toBe(testDir);
    });
  });
});
