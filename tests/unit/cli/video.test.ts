/**
 * Tests for the video CLI command.
 *
 * Tests Commander action handlers directly via program.parseAsync().
 * All heavy plugin/AI dependencies are mocked. vi.hoisted() is used for
 * any variables referenced inside vi.mock() factories (hoisted before imports).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted stubs ──────────────────────────────────────────────────────────────
// Variables used inside vi.mock() factories MUST be declared with vi.hoisted().

const mocks = vi.hoisted(() => {
  const listProjects = vi.fn().mockReturnValue([]);
  const loadProject = vi.fn().mockReturnValue(null);
  const orchestratorRun = vi.fn();

  // PipelineOrchestrator mock — must be a real constructor function so that
  // new PipelineOrchestrator(...) works inside buildOrchestrator().
  function MockPipelineOrchestrator(this: { run: typeof orchestratorRun }) {
    this.run = orchestratorRun;
  }
  MockPipelineOrchestrator.listProjects = listProjects;
  MockPipelineOrchestrator.loadProject = loadProject;

  const hasPendingRequest = vi.fn().mockReturnValue(false);
  const getPendingRequests = vi.fn().mockReturnValue([]);
  const handleApprovalResponse = vi.fn();

  // ApprovalGate mock — must be a real constructor so new ApprovalGate(bus)
  // inside buildOrchestrator() doesn't throw "not a constructor".
  function MockApprovalGate() { /* no-op */ }
  MockApprovalGate.hasPendingRequest = hasPendingRequest;
  MockApprovalGate.getPendingRequests = getPendingRequests;
  MockApprovalGate.handleApprovalResponse = handleApprovalResponse;

  const configParse = vi.fn().mockReturnValue({
    heygenApiKey: 'mock-heygen-key',
    avatarId: 'mock-avatar',
    voiceId: 'mock-voice',
    assemblyAiApiKey: 'mock-assembly-key',
    youtubeClientId: 'mock-yt-client',
    youtubeClientSecret: 'mock-yt-secret',
    youtubeRefreshToken: 'mock-yt-refresh',
    openaiApiKey: 'mock-openai-key',
    outputDir: '/tmp/ari-video-test',
    requireApproval: false,
    autoGenerateThumbnail: true,
  });

  return {
    listProjects,
    loadProject,
    orchestratorRun,
    MockPipelineOrchestrator,
    hasPendingRequest,
    getPendingRequests,
    handleApprovalResponse,
    MockApprovalGate,
    configParse,
  };
});

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('../../../src/plugins/video-pipeline/pipeline-orchestrator.js', () => ({
  PipelineOrchestrator: mocks.MockPipelineOrchestrator,
}));

vi.mock('../../../src/plugins/video-pipeline/approval-gate.js', () => ({
  ApprovalGate: mocks.MockApprovalGate,
}));

vi.mock('../../../src/plugins/video-pipeline/types.js', () => ({
  VideoPipelineConfigSchema: { parse: mocks.configParse },
}));

vi.mock('../../../src/plugins/video-pipeline/script-generator.js', () => ({
  ScriptGenerator: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../src/plugins/video-pipeline/avatar-renderer.js', () => ({
  AvatarRenderer: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../src/plugins/video-pipeline/captions-generator.js', () => ({
  CaptionsGenerator: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../src/plugins/video-pipeline/video-assembler.js', () => ({
  VideoAssembler: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../src/plugins/video-pipeline/thumbnail-generator.js', () => ({
  ThumbnailGenerator: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../src/plugins/video-pipeline/youtube-publisher.js', () => ({
  YouTubePublisher: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../src/ai/orchestrator.js', () => ({
  AIOrchestrator: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue('mock AI response'),
  })),
}));

vi.mock('../../../src/ai/model-registry.js', () => ({
  ModelRegistry: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../../src/kernel/event-bus.js', () => ({
  EventBus: vi.fn().mockImplementation(() => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { Command } from 'commander';
import { registerVideoCommand } from '../../../src/cli/commands/video.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'aaaa1111-bbbb-cccc-dddd-000000000001',
    scriptId: 'script-001',
    format: 'long_form',
    title: 'My Test Video About TypeScript',
    status: 'published',
    tags: ['typescript', 'ai'],
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    createdAt: new Date('2026-02-18T10:00:00Z').toISOString(),
    ...overrides,
  };
}

function makePendingRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'req-0001-00000000-0000',
    videoProjectId: 'aaaa1111-bbbb-cccc-dddd-000000000001',
    type: 'script',
    previewText: 'Please review this script',
    status: 'pending',
    requestedAt: new Date('2026-02-18T09:00:00Z').toISOString(),
    ...overrides,
  };
}

function logOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((c) => String(c[0])).join('\n');
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('video CLI', () => {
  let program: Command;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset all mock state before each test
    mocks.listProjects.mockReset().mockReturnValue([]);
    mocks.loadProject.mockReset().mockReturnValue(null);
    mocks.orchestratorRun.mockReset();
    mocks.hasPendingRequest.mockReset().mockReturnValue(false);
    mocks.getPendingRequests.mockReset().mockReturnValue([]);
    mocks.handleApprovalResponse.mockReset();
    mocks.configParse.mockReset().mockReturnValue({
      heygenApiKey: 'mock-heygen-key',
      avatarId: 'mock-avatar',
      voiceId: 'mock-voice',
      assemblyAiApiKey: 'mock-assembly-key',
      youtubeClientId: 'mock-yt-client',
      youtubeClientSecret: 'mock-yt-secret',
      youtubeRefreshToken: 'mock-yt-refresh',
      openaiApiKey: 'mock-openai-key',
      outputDir: '/tmp/ari-video-test',
      requireApproval: false,
      autoGenerateThumbnail: true,
    });

    // Fresh Commander instance per test — prevents action handler bleed
    program = new Command();
    program.exitOverride();
    registerVideoCommand(program);

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Convert process.exit into a thrown error so tests can assert on it
    vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── video list ─────────────────────────────────────────────────────────────

  describe('video list', () => {
    it('shows "no projects" message when there are no projects', async () => {
      mocks.listProjects.mockReturnValue([]);

      await program.parseAsync(['node', 'ari', 'video', 'list']);

      expect(mocks.listProjects).toHaveBeenCalledOnce();
      expect(logOutput(logSpy)).toContain('No video projects found');
    });

    it('displays a formatted row for each project when projects exist', async () => {
      mocks.listProjects.mockReturnValue([
        makeProject({
          id: 'aaaa0001-0000-0000-0000-000000000001',
          title: 'First Project',
          status: 'published',
        }),
        makeProject({
          id: 'bbbb0002-0000-0000-0000-000000000002',
          title: 'Second Project',
          status: 'rendering',
        }),
      ]);

      await program.parseAsync(['node', 'ari', 'video', 'list']);

      expect(mocks.listProjects).toHaveBeenCalledOnce();
      const output = logOutput(logSpy);
      expect(output).toContain('Video Projects');
      expect(output).toContain('First Project');
      expect(output).toContain('Second Project');
    });

    it('outputs a raw JSON array with --json flag', async () => {
      mocks.listProjects.mockReturnValue([makeProject({ title: 'JSON Project' })]);

      await program.parseAsync(['node', 'ari', 'video', 'list', '--json']);

      const jsonCall = logSpy.mock.calls.find((c) => {
        try {
          return Array.isArray(JSON.parse(String(c[0])));
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(String(jsonCall![0])) as { title: string }[];
      expect(parsed[0].title).toBe('JSON Project');
    });

    it('filters projects by --status when provided', async () => {
      mocks.listProjects.mockReturnValue([
        makeProject({ title: 'Done', status: 'published' }),
        makeProject({ title: 'In Progress', status: 'rendering' }),
      ]);

      await program.parseAsync(['node', 'ari', 'video', 'list', '--status', 'published']);

      const output = logOutput(logSpy);
      expect(output).toContain('Done');
      expect(output).not.toContain('In Progress');
    });
  });

  // ── video status ───────────────────────────────────────────────────────────

  describe('video status', () => {
    it('shows an error and exits when the project is not found', async () => {
      mocks.loadProject.mockReturnValue(null);
      mocks.listProjects.mockReturnValue([]);

      await expect(
        program.parseAsync(['node', 'ari', 'video', 'status', 'nonexistent-id']),
      ).rejects.toThrow('process.exit(1)');

      const errOutput = logOutput(errorSpy);
      expect(errOutput).toContain('Project not found');
      expect(errOutput).toContain('nonexistent-id');
    });

    it('displays project details when found by exact id', async () => {
      const project = makeProject({
        id: 'exact-id-1234',
        title: 'Exact Match Project',
        status: 'published',
        format: 'tutorial',
      });
      mocks.loadProject.mockReturnValue(project);
      mocks.getPendingRequests.mockReturnValue([]);

      await program.parseAsync(['node', 'ari', 'video', 'status', 'exact-id-1234']);

      expect(mocks.loadProject).toHaveBeenCalledWith('exact-id-1234');
      const output = logOutput(logSpy);
      expect(output).toContain('Exact Match Project');
      expect(output).toContain('exact-id-1234');
      expect(output).toContain('tutorial');
      expect(output).toContain('published');
    });

    it('shows pending approval requests when they exist for the project', async () => {
      const project = makeProject({ id: 'proj-with-pending' });
      mocks.loadProject.mockReturnValue(project);

      const request = makePendingRequest({
        id: 'req-abc-0000-0000',
        videoProjectId: 'proj-with-pending',
        type: 'script',
      });
      mocks.getPendingRequests.mockReturnValue([request]);

      await program.parseAsync(['node', 'ari', 'video', 'status', 'proj-with-pending']);

      const output = logOutput(logSpy);
      expect(output).toContain('Pending Approvals');
      expect(output).toContain('script');
    });

    it('outputs raw JSON for the project with --json flag', async () => {
      const project = makeProject({ id: 'json-proj', title: 'JSON Status Project' });
      mocks.loadProject.mockReturnValue(project);
      mocks.getPendingRequests.mockReturnValue([]);

      await program.parseAsync(['node', 'ari', 'video', 'status', 'json-proj', '--json']);

      const jsonCall = logSpy.mock.calls.find((c) => {
        try {
          const parsed = JSON.parse(String(c[0])) as { id?: string };
          return parsed.id === 'json-proj';
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });

    it('shows error when project not found and prefix search also finds nothing', async () => {
      // The source does Object.assign(project ?? {}, match) where project is null —
      // the prefix-match branch has a bug where the null project is never reassigned,
      // so it falls through to `if (!project) return` and exits silently. This test
      // verifies the "not found" error path when listProjects returns no prefix match.
      mocks.loadProject.mockReturnValue(null);
      mocks.listProjects.mockReturnValue([
        makeProject({ id: 'different-id-entirely', title: 'Unrelated Project' }),
      ]);

      await expect(
        program.parseAsync(['node', 'ari', 'video', 'status', 'no-match-prefix']),
      ).rejects.toThrow('process.exit(1)');

      const errOutput = logOutput(errorSpy);
      expect(errOutput).toContain('Project not found');
    });
  });

  // ── video approve ──────────────────────────────────────────────────────────

  describe('video approve', () => {
    it('shows an error and exits when there is no pending request', async () => {
      mocks.hasPendingRequest.mockReturnValue(false);

      await expect(
        program.parseAsync(['node', 'ari', 'video', 'approve', 'req-does-not-exist']),
      ).rejects.toThrow('process.exit(1)');

      expect(mocks.hasPendingRequest).toHaveBeenCalledWith('req-does-not-exist');
      const errOutput = logOutput(errorSpy);
      expect(errOutput).toContain('No pending approval request');
      expect(errOutput).toContain('req-does-not-exist');
    });

    it('calls handleApprovalResponse with "approve" action when request exists', async () => {
      mocks.hasPendingRequest.mockReturnValue(true);

      await program.parseAsync(['node', 'ari', 'video', 'approve', 'req-001']);

      expect(mocks.hasPendingRequest).toHaveBeenCalledWith('req-001');
      expect(mocks.handleApprovalResponse).toHaveBeenCalledWith(
        expect.anything(),  // EventBus instance
        'req-001',
        'approve',
        undefined,           // no --message flag provided
      );
    });

    it('passes the --message option through to handleApprovalResponse', async () => {
      mocks.hasPendingRequest.mockReturnValue(true);

      await program.parseAsync([
        'node', 'ari', 'video', 'approve', 'req-002', '--message', 'Looks great!',
      ]);

      expect(mocks.handleApprovalResponse).toHaveBeenCalledWith(
        expect.anything(),
        'req-002',
        'approve',
        'Looks great!',
      );
    });

    it('prints a confirmation message on successful approval', async () => {
      mocks.hasPendingRequest.mockReturnValue(true);

      await program.parseAsync(['node', 'ari', 'video', 'approve', 'req-003']);

      const output = logOutput(logSpy);
      expect(output).toContain('Approved');
      expect(output).toContain('req-003');
    });
  });

  // ── video reject ───────────────────────────────────────────────────────────

  describe('video reject', () => {
    it('shows an error and exits when there is no pending request', async () => {
      mocks.hasPendingRequest.mockReturnValue(false);

      await expect(
        program.parseAsync(['node', 'ari', 'video', 'reject', 'req-missing']),
      ).rejects.toThrow('process.exit(1)');

      expect(mocks.hasPendingRequest).toHaveBeenCalledWith('req-missing');
      const errOutput = logOutput(errorSpy);
      expect(errOutput).toContain('No pending approval request');
    });

    it('calls handleApprovalResponse with "reject" action when request exists', async () => {
      mocks.hasPendingRequest.mockReturnValue(true);

      await program.parseAsync(['node', 'ari', 'video', 'reject', 'req-to-reject']);

      expect(mocks.handleApprovalResponse).toHaveBeenCalledWith(
        expect.anything(),
        'req-to-reject',
        'reject',
        'Rejected via CLI',  // default rejection reason from source
      );
    });

    it('passes a custom --message as the rejection reason', async () => {
      mocks.hasPendingRequest.mockReturnValue(true);

      await program.parseAsync([
        'node', 'ari', 'video', 'reject', 'req-custom', '--message', 'Audio out of sync',
      ]);

      expect(mocks.handleApprovalResponse).toHaveBeenCalledWith(
        expect.anything(),
        'req-custom',
        'reject',
        'Audio out of sync',
      );
    });

    it('prints a confirmation message on successful rejection', async () => {
      mocks.hasPendingRequest.mockReturnValue(true);

      await program.parseAsync(['node', 'ari', 'video', 'reject', 'req-confirm']);

      const output = logOutput(logSpy);
      expect(output).toContain('Rejected');
      expect(output).toContain('req-confirm');
    });
  });

  // ── video create ───────────────────────────────────────────────────────────

  describe('video create', () => {
    beforeEach(() => {
      mocks.orchestratorRun.mockResolvedValue(
        makeProject({
          id: 'created-project-id',
          title: 'AI and the Future of Work',
          status: 'published',
          format: 'long_form',
        }),
      );
    });

    it('calls orchestrator.run() with the correct topic and default format', async () => {
      await program.parseAsync([
        'node', 'ari', 'video', 'create', 'AI and the Future of Work', '--no-approval',
      ]);

      expect(mocks.orchestratorRun).toHaveBeenCalledOnce();
      const runArgs = mocks.orchestratorRun.mock.calls[0][0] as {
        topic: string;
        format: string;
        keywords: string[];
      };
      expect(runArgs.topic).toBe('AI and the Future of Work');
      expect(runArgs.format).toBe('long_form');
      expect(runArgs.keywords).toEqual([]);
    });

    it('parses comma-separated keywords from --keywords option', async () => {
      await program.parseAsync([
        'node', 'ari', 'video', 'create', 'Productivity Hacks',
        '--keywords', 'productivity,focus,deep work',
        '--no-approval',
      ]);

      const runArgs = mocks.orchestratorRun.mock.calls[0][0] as { keywords: string[] };
      expect(runArgs.keywords).toEqual(['productivity', 'focus', 'deep work']);
    });

    it('uses the --format option when provided', async () => {
      await program.parseAsync([
        'node', 'ari', 'video', 'create', 'Quick Tip',
        '--format', 'short',
        '--no-approval',
      ]);

      const runArgs = mocks.orchestratorRun.mock.calls[0][0] as { format: string };
      expect(runArgs.format).toBe('short');
    });

    it('prints pipeline complete summary after a successful run', async () => {
      await program.parseAsync([
        'node', 'ari', 'video', 'create', 'Test Topic', '--no-approval',
      ]);

      const output = logOutput(logSpy);
      expect(output).toContain('Pipeline complete');
      expect(output).toContain('created-project-id');
      expect(output).toContain('AI and the Future of Work');
    });

    it('outputs JSON project when --json flag is set', async () => {
      await program.parseAsync([
        'node', 'ari', 'video', 'create', 'Test Topic', '--no-approval', '--json',
      ]);

      const jsonCall = logSpy.mock.calls.find((c) => {
        try {
          const parsed = JSON.parse(String(c[0])) as { id?: string };
          return parsed.id === 'created-project-id';
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
    });

    it('prints an error message and exits when orchestrator.run() throws', async () => {
      mocks.orchestratorRun.mockRejectedValue(new Error('HeyGen API unreachable'));

      await expect(
        program.parseAsync(['node', 'ari', 'video', 'create', 'Bad Topic', '--no-approval']),
      ).rejects.toThrow('process.exit(1)');

      const errOutput = logOutput(errorSpy);
      expect(errOutput).toContain('Pipeline failed');
      expect(errOutput).toContain('HeyGen API unreachable');
    });
  });
});
