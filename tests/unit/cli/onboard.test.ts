import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerOnboardCommand } from '../../../src/cli/commands/onboard.js';

// Mock all dependencies
vi.mock('../../../src/kernel/config.js', () => ({
  ensureConfigDir: vi.fn().mockResolvedValue(undefined),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  DEFAULT_CONFIG: {
    version: '2.1.0',
    gateway: { port: 3141, host: '127.0.0.1' },
  },
}));

vi.mock('../../../src/kernel/audit.js', () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../src/system/storage.js', () => ({
  ensureContextsDir: vi.fn().mockResolvedValue(undefined),
}));

describe('Onboard Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('registerOnboardCommand()', () => {
    it('should register the onboard command', () => {
      registerOnboardCommand(program);

      const onboardCmd = program.commands.find(cmd => cmd.name() === 'onboard');
      expect(onboardCmd).toBeDefined();
      expect(onboardCmd?.description()).toBe('ARI system initialization and onboarding');
    });

    it('should register init subcommand', () => {
      registerOnboardCommand(program);

      const onboardCmd = program.commands.find(cmd => cmd.name() === 'onboard');
      expect(onboardCmd).toBeDefined();

      const initCmd = onboardCmd?.commands.find(cmd => cmd.name() === 'init');
      expect(initCmd).toBeDefined();
      expect(initCmd?.description()).toBe('Initialize ARI V2.0 system');
    });

    it('should have correct command structure', () => {
      registerOnboardCommand(program);

      const onboardCmd = program.commands.find(cmd => cmd.name() === 'onboard');
      expect(onboardCmd).toBeDefined();
      expect(onboardCmd?.commands.length).toBeGreaterThan(0);
    });
  });
});
