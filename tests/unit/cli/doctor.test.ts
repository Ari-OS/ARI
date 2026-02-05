import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerDoctorCommand } from '../../../src/cli/commands/doctor.js';

// Mock the modules
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      access: vi.fn(),
    },
  };
});

vi.mock('../../../src/kernel/config.js', () => ({
  CONFIG_DIR: '/test/.ari',
  CONFIG_PATH: '/test/.ari/config.json',
  loadConfig: vi.fn(),
}));

vi.mock('../../../src/kernel/audit.js', () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    verify: vi.fn().mockReturnValue({ valid: true, details: '' }),
  })),
}));

vi.mock('../../../src/system/storage.js', () => ({
  getContextsDir: vi.fn().mockReturnValue('/test/.ari/contexts'),
}));

describe('Doctor Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('registerDoctorCommand()', () => {
    it('should register the doctor command', () => {
      registerDoctorCommand(program);

      const doctorCmd = program.commands.find(cmd => cmd.name() === 'doctor');
      expect(doctorCmd).toBeDefined();
      expect(doctorCmd?.description()).toBe('Run comprehensive system health checks');
    });

    it('should register command with correct structure', () => {
      registerDoctorCommand(program);

      const doctorCmd = program.commands.find(cmd => cmd.name() === 'doctor');
      expect(doctorCmd).toBeDefined();
    });
  });

  describe('Health Check Flow', () => {
    it('should be a valid commander command', async () => {
      registerDoctorCommand(program);

      // Verify command was registered
      expect(program.commands.length).toBeGreaterThan(0);

      const cmd = program.commands.find(c => c.name() === 'doctor');
      expect(cmd).toBeDefined();
    });
  });
});
