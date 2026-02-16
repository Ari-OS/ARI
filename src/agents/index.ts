/**
 * Agent Layer - Autonomous decision-making components
 *
 * This layer provides specialized agents that coordinate to process messages,
 * manage memory, execute tools, and maintain system security.
 */

export { Guardian } from './guardian.js';
export { MemoryManager } from './memory-manager.js';
export { Executor } from './executor.js';
export { Planner } from './planner.js';
export { Core } from './core.js';
export { LearningMachine } from './learning-machine.js';
export type { LearnedPattern, PatternType, Interaction, InteractionType } from './learning-machine.js';
export { Scratchpad } from './scratchpad.js';
export type { ScratchpadEntry, ScratchpadContext } from './scratchpad.js';
export { TemporalMemory } from './temporal-memory.js';
export type {
  DailyNote,
  DailyNoteEntry,
  DailyNoteEntryType,
  WeeklyMemorySynthesis,
  LongTermMemoryEntry,
  LongTermCategory,
  TemporalMemoryOptions,
  TemporalMemoryStats,
} from './temporal-memory.js';
