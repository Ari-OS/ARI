/**
 * Tests for /skills Telegram command — list and invoke skills
 */

import { describe, it, expect, vi } from 'vitest';
import { handleSkills } from '../../../../../src/plugins/telegram-bot/commands/skills.js';
import type { EventBus } from '../../../../../src/kernel/event-bus.js';

describe('/skills command', () => {
  function createMockCtx(text: string) {
    return {
      message: { text },
      from: { id: 123456 },
      reply: vi.fn(),
    } as unknown as Parameters<typeof handleSkills>[0];
  }

  function createMockEventBus() {
    return {
      emit: vi.fn(),
    } as unknown as EventBus;
  }

  it('should list available skills when no arguments', async () => {
    const ctx = createMockCtx('/skills');
    const eventBus = createMockEventBus();

    await handleSkills(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Available Skills');
    expect(reply).toContain('diagram-generator');
  });

  it('should show usage for invoke without skill name', async () => {
    const ctx = createMockCtx('/skills invoke');
    const eventBus = createMockEventBus();

    await handleSkills(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Usage');
  });

  it('should show placeholder for skill invocation', async () => {
    const ctx = createMockCtx('/skills invoke diagram-generator');
    const eventBus = createMockEventBus();

    await handleSkills(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Skill Invocation');
    expect(reply).toContain('diagram-generator');
  });

  it('should handle unknown subcommand', async () => {
    const ctx = createMockCtx('/skills unknown');
    const eventBus = createMockEventBus();

    await handleSkills(ctx, eventBus);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(reply).toContain('Unknown subcommand');
  });

  it('should emit telemetry events', async () => {
    const ctx = createMockCtx('/skills');
    const eventBus = createMockEventBus();

    await handleSkills(ctx, eventBus);

    expect(eventBus.emit).toHaveBeenCalledWith('telegram:skills_listed', {
      userId: 123456,
    });
  });
});
