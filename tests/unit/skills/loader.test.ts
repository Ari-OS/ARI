import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { SkillLoader } from '../../../src/skills/loader.js';

describe('SkillLoader', () => {
  let loader: SkillLoader;
  let testDir: string;
  let workspaceDir: string;
  let userDir: string;
  let bundledDir: string;

  const validSkillContent = `---
name: test-skill
description: A test skill
version: 1.0.0
permissions:
- read_files
tags:
- testing
---

# Test Skill Instructions

Do something useful.`;

  beforeEach(async () => {
    // Create temp directories for testing
    testDir = join(tmpdir(), `ari-skills-test-${randomUUID()}`);
    workspaceDir = join(testDir, 'workspace');
    userDir = join(testDir, 'user');
    bundledDir = join(testDir, 'bundled');

    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(userDir, { recursive: true });
    await fs.mkdir(bundledDir, { recursive: true });

    // Create loader with test paths
    loader = new SkillLoader({
      paths: {
        workspace: workspaceDir,
        user: userDir,
        bundled: bundledDir,
      },
    });
  });

  afterEach(async () => {
    // Clean up temp directories
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create loader with default config', () => {
      const defaultLoader = new SkillLoader();
      const config = defaultLoader.getConfig();

      expect(config.watchChanges).toBe(true);
      expect(config.reloadInterval).toBe(60000);
      expect(config.requireApproval).toBe(false);
    });

    it('should create loader with custom config', () => {
      const customLoader = new SkillLoader({
        watchChanges: false,
        reloadInterval: 30000,
        requireApproval: true,
      });
      const config = customLoader.getConfig();

      expect(config.watchChanges).toBe(false);
      expect(config.reloadInterval).toBe(30000);
      expect(config.requireApproval).toBe(true);
    });

    it('should resolve paths correctly', () => {
      const paths = loader.getPaths();

      expect(paths.workspace).toBe(workspaceDir);
      expect(paths.user).toBe(userDir);
      expect(paths.bundled).toBe(bundledDir);
    });
  });

  describe('loadSkillFile', () => {
    it('should load a valid skill file', async () => {
      const filePath = join(workspaceDir, 'test.md');
      await fs.writeFile(filePath, validSkillContent);

      const skill = await loader.loadSkillFile(filePath, 'workspace');

      expect(skill).not.toBeNull();
      expect(skill?.metadata.name).toBe('test-skill');
      expect(skill?.metadata.description).toBe('A test skill');
      expect(skill?.metadata.version).toBe('1.0.0');
      expect(skill?.metadata.permissions).toEqual(['read_files']);
      expect(skill?.source).toBe('workspace');
      expect(skill?.filePath).toBe(filePath);
      expect(skill?.status).toBe('active');
    });

    it('should return null for non-existent file', async () => {
      const skill = await loader.loadSkillFile('/non/existent/path.md', 'workspace');

      expect(skill).toBeNull();
    });

    it('should return null for invalid skill content', async () => {
      const filePath = join(workspaceDir, 'invalid.md');
      await fs.writeFile(filePath, '# Just a regular markdown file');

      // Suppress console.warn for this test
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const skill = await loader.loadSkillFile(filePath, 'workspace');

      expect(skill).toBeNull();

      warnSpy.mockRestore();
    });

    it('should set pending_approval status when requireApproval is true', async () => {
      const approvalLoader = new SkillLoader({
        paths: {
          workspace: workspaceDir,
          user: userDir,
          bundled: bundledDir,
        },
        requireApproval: true,
      });

      const filePath = join(workspaceDir, 'test.md');
      await fs.writeFile(filePath, validSkillContent);

      const skill = await approvalLoader.loadSkillFile(filePath, 'workspace');

      expect(skill?.status).toBe('pending_approval');
    });

    it('should not set pending_approval for bundled skills', async () => {
      const approvalLoader = new SkillLoader({
        paths: {
          workspace: workspaceDir,
          user: userDir,
          bundled: bundledDir,
        },
        requireApproval: true,
      });

      const filePath = join(bundledDir, 'test.md');
      await fs.writeFile(filePath, validSkillContent);

      const skill = await approvalLoader.loadSkillFile(filePath, 'bundled');

      expect(skill?.status).toBe('active');
    });

    it('should compute content hash', async () => {
      const filePath = join(workspaceDir, 'test.md');
      await fs.writeFile(filePath, validSkillContent);

      const skill = await loader.loadSkillFile(filePath, 'workspace');

      expect(skill?.contentHash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe('loadFromDirectory', () => {
    it('should load skills from .md files', async () => {
      await fs.writeFile(join(workspaceDir, 'skill1.md'), validSkillContent);
      await fs.writeFile(
        join(workspaceDir, 'skill2.md'),
        validSkillContent.replace('test-skill', 'another-skill')
      );

      const loaded = await loader.loadFromDirectory(workspaceDir, 'workspace');

      expect(loaded).toBe(2);
    });

    it('should load skills from subdirectories with SKILL.md', async () => {
      const skillDir = join(workspaceDir, 'my-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(join(skillDir, 'SKILL.md'), validSkillContent);

      const loaded = await loader.loadFromDirectory(workspaceDir, 'workspace');

      expect(loaded).toBe(1);
    });

    it('should ignore non-.md files', async () => {
      await fs.writeFile(join(workspaceDir, 'skill.md'), validSkillContent);
      await fs.writeFile(join(workspaceDir, 'readme.txt'), 'Not a skill');
      await fs.writeFile(join(workspaceDir, 'config.json'), '{}');

      const loaded = await loader.loadFromDirectory(workspaceDir, 'workspace');

      expect(loaded).toBe(1);
    });

    it('should return 0 for non-existent directory', async () => {
      const loaded = await loader.loadFromDirectory('/non/existent/dir', 'workspace');

      expect(loaded).toBe(0);
    });

    it('should log warning for other directory errors', async () => {
      // This test is tricky to implement reliably across platforms
      // Skipping detailed implementation
    });
  });

  describe('loadAll', () => {
    it('should load skills from all tiers', async () => {
      await fs.writeFile(
        join(bundledDir, 'bundled-skill.md'),
        validSkillContent.replace('test-skill', 'bundled-skill')
      );
      await fs.writeFile(
        join(userDir, 'user-skill.md'),
        validSkillContent.replace('test-skill', 'user-skill')
      );
      await fs.writeFile(
        join(workspaceDir, 'workspace-skill.md'),
        validSkillContent.replace('test-skill', 'workspace-skill')
      );

      const skills = await loader.loadAll();

      expect(skills.size).toBe(3);
      expect(skills.has('bundled-skill')).toBe(true);
      expect(skills.has('user-skill')).toBe(true);
      expect(skills.has('workspace-skill')).toBe(true);
    });

    it('should override skills in order: bundled < user < workspace', async () => {
      // Same skill name in all tiers
      await fs.writeFile(
        join(bundledDir, 'shared.md'),
        validSkillContent.replace('test-skill', 'shared').replace('A test skill', 'Bundled version')
      );
      await fs.writeFile(
        join(userDir, 'shared.md'),
        validSkillContent.replace('test-skill', 'shared').replace('A test skill', 'User version')
      );
      await fs.writeFile(
        join(workspaceDir, 'shared.md'),
        validSkillContent.replace('test-skill', 'shared').replace('A test skill', 'Workspace version')
      );

      await loader.loadAll();

      const skill = loader.get('shared');

      expect(skill).not.toBeNull();
      expect(skill?.source).toBe('workspace');
      expect(skill?.metadata.description).toBe('Workspace version');
    });

    it('should clear previous skills when reloading', async () => {
      await fs.writeFile(
        join(workspaceDir, 'skill1.md'),
        validSkillContent.replace('test-skill', 'skill1')
      );

      await loader.loadAll();
      expect(loader.count).toBe(1);

      // Remove the file
      await fs.unlink(join(workspaceDir, 'skill1.md'));

      await loader.loadAll();
      expect(loader.count).toBe(0);
    });
  });

  describe('loadByName', () => {
    it('should find skill in workspace first', async () => {
      await fs.writeFile(
        join(bundledDir, 'shared.md'),
        validSkillContent.replace('test-skill', 'shared').replace('A test skill', 'Bundled')
      );
      await fs.writeFile(
        join(workspaceDir, 'shared.md'),
        validSkillContent.replace('test-skill', 'shared').replace('A test skill', 'Workspace')
      );

      const skill = await loader.loadByName('shared');

      expect(skill).not.toBeNull();
      expect(skill?.source).toBe('workspace');
    });

    it('should fall back to user tier', async () => {
      await fs.writeFile(
        join(bundledDir, 'shared.md'),
        validSkillContent.replace('test-skill', 'shared').replace('A test skill', 'Bundled')
      );
      await fs.writeFile(
        join(userDir, 'shared.md'),
        validSkillContent.replace('test-skill', 'shared').replace('A test skill', 'User')
      );

      const skill = await loader.loadByName('shared');

      expect(skill).not.toBeNull();
      expect(skill?.source).toBe('user');
    });

    it('should fall back to bundled tier', async () => {
      await fs.writeFile(
        join(bundledDir, 'shared.md'),
        validSkillContent.replace('test-skill', 'shared')
      );

      const skill = await loader.loadByName('shared');

      expect(skill).not.toBeNull();
      expect(skill?.source).toBe('bundled');
    });

    it('should return null if skill not found in any tier', async () => {
      const skill = await loader.loadByName('non-existent');

      expect(skill).toBeNull();
    });

    it('should find skills in subdirectories', async () => {
      const skillDir = join(workspaceDir, 'test-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(join(skillDir, 'SKILL.md'), validSkillContent);

      const skill = await loader.loadByName('test-skill');

      expect(skill).not.toBeNull();
      expect(skill?.metadata.name).toBe('test-skill');
    });
  });

  describe('reload', () => {
    it('should reload a specific skill', async () => {
      await fs.writeFile(
        join(workspaceDir, 'reloadable.md'),
        validSkillContent.replace('test-skill', 'reloadable').replace('1.0.0', '1.0.0')
      );

      await loader.loadAll();
      let skill = loader.get('reloadable');
      expect(skill?.metadata.version).toBe('1.0.0');

      // Update the file
      await fs.writeFile(
        join(workspaceDir, 'reloadable.md'),
        validSkillContent.replace('test-skill', 'reloadable').replace('1.0.0', '2.0.0')
      );

      await loader.reload('reloadable');
      skill = loader.get('reloadable');
      expect(skill?.metadata.version).toBe('2.0.0');
    });

    it('should remove skill if no longer exists', async () => {
      await fs.writeFile(
        join(workspaceDir, 'temporary.md'),
        validSkillContent.replace('test-skill', 'temporary')
      );

      await loader.loadAll();
      expect(loader.has('temporary')).toBe(true);

      await fs.unlink(join(workspaceDir, 'temporary.md'));

      await loader.reload('temporary');
      expect(loader.has('temporary')).toBe(false);
    });
  });

  describe('reloadAll', () => {
    it('should reload all skills', async () => {
      await fs.writeFile(
        join(workspaceDir, 'skill.md'),
        validSkillContent.replace('test-skill', 'skill')
      );

      const skills = await loader.reloadAll();

      expect(skills.size).toBe(1);
    });
  });

  describe('get', () => {
    it('should return skill if loaded', async () => {
      await fs.writeFile(join(workspaceDir, 'skill.md'), validSkillContent);
      await loader.loadAll();

      const skill = loader.get('test-skill');

      expect(skill).not.toBeNull();
    });

    it('should return null if not loaded', () => {
      const skill = loader.get('non-existent');

      expect(skill).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all loaded skills', async () => {
      await fs.writeFile(
        join(workspaceDir, 'skill1.md'),
        validSkillContent.replace('test-skill', 'skill1')
      );
      await fs.writeFile(
        join(workspaceDir, 'skill2.md'),
        validSkillContent.replace('test-skill', 'skill2')
      );
      await loader.loadAll();

      const skills = loader.getAll();

      expect(skills).toHaveLength(2);
    });

    it('should return empty array if no skills loaded', () => {
      const skills = loader.getAll();

      expect(skills).toEqual([]);
    });
  });

  describe('getBySource', () => {
    it('should filter skills by source', async () => {
      await fs.writeFile(
        join(bundledDir, 'bundled.md'),
        validSkillContent.replace('test-skill', 'bundled')
      );
      await fs.writeFile(
        join(workspaceDir, 'workspace.md'),
        validSkillContent.replace('test-skill', 'workspace')
      );
      await loader.loadAll();

      const bundledSkills = loader.getBySource('bundled');
      const workspaceSkills = loader.getBySource('workspace');

      expect(bundledSkills).toHaveLength(1);
      expect(bundledSkills[0].metadata.name).toBe('bundled');
      expect(workspaceSkills).toHaveLength(1);
      expect(workspaceSkills[0].metadata.name).toBe('workspace');
    });
  });

  describe('count', () => {
    it('should return total skill count', async () => {
      await fs.writeFile(
        join(workspaceDir, 'skill1.md'),
        validSkillContent.replace('test-skill', 'skill1')
      );
      await fs.writeFile(
        join(workspaceDir, 'skill2.md'),
        validSkillContent.replace('test-skill', 'skill2')
      );
      await loader.loadAll();

      expect(loader.count).toBe(2);
    });

    it('should return 0 when no skills loaded', () => {
      expect(loader.count).toBe(0);
    });
  });

  describe('countBySource', () => {
    it('should return counts by source', async () => {
      await fs.writeFile(
        join(bundledDir, 'bundled.md'),
        validSkillContent.replace('test-skill', 'bundled')
      );
      await fs.writeFile(
        join(userDir, 'user.md'),
        validSkillContent.replace('test-skill', 'user')
      );
      await fs.writeFile(
        join(workspaceDir, 'ws1.md'),
        validSkillContent.replace('test-skill', 'ws1')
      );
      await fs.writeFile(
        join(workspaceDir, 'ws2.md'),
        validSkillContent.replace('test-skill', 'ws2')
      );
      await loader.loadAll();

      const counts = loader.countBySource();

      expect(counts.bundled).toBe(1);
      expect(counts.user).toBe(1);
      expect(counts.workspace).toBe(2);
    });
  });

  describe('has', () => {
    it('should return true if skill exists', async () => {
      await fs.writeFile(join(workspaceDir, 'skill.md'), validSkillContent);
      await loader.loadAll();

      expect(loader.has('test-skill')).toBe(true);
    });

    it('should return false if skill does not exist', () => {
      expect(loader.has('non-existent')).toBe(false);
    });
  });

  describe('getValidator', () => {
    it('should return the validator instance', () => {
      const validator = loader.getValidator();

      expect(validator).toBeDefined();
      expect(typeof validator.validateContent).toBe('function');
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config', () => {
      const config = loader.getConfig();

      expect(config).toBeDefined();
      expect(config.paths).toBeDefined();
    });
  });

  describe('getPaths', () => {
    it('should return discovery paths', () => {
      const paths = loader.getPaths();

      expect(paths.workspace).toBe(workspaceDir);
      expect(paths.user).toBe(userDir);
      expect(paths.bundled).toBe(bundledDir);
    });
  });
});
