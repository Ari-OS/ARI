import { z } from 'zod';

/**
 * Context types grounded in v12 CONTEXTS/README.md:
 * - Ventures: explicit mention trigger, strict isolation
 * - Life domains: topic detection trigger, moderate isolation
 */
export const ContextTypeSchema = z.enum(['venture', 'life']);
export type ContextType = z.infer<typeof ContextTypeSchema>;

export const ContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ContextTypeSchema,
  description: z.string().optional(),
  partition: z.string(),
  triggers: z.array(z.string()),
  active: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type Context = z.infer<typeof ContextSchema>;

/**
 * Route result from system router — records what the system layer
 * decided to do with a kernel-accepted message.
 * Grounded in v12 SYSTEM/ROUTER.md: classify → route → audit.
 */
export const RouteResultSchema = z.object({
  messageId: z.string(),
  route: z.string(),
  contextId: z.string().optional(),
  contextName: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type RouteResult = z.infer<typeof RouteResultSchema>;

// PermissionTier is now defined in kernel/types.ts (canonical location)

/**
 * Active context state file (~/.ari/contexts/active.json)
 */
export const ActiveContextSchema = z.object({
  contextId: z.string().nullable(),
  activatedAt: z.string().datetime().nullable(),
});
export type ActiveContext = z.infer<typeof ActiveContextSchema>;
