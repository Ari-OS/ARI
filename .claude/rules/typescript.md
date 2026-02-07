# TypeScript Rules

## Strict Mode

- `strictNullChecks: true`
- `noImplicitAny: true`
- No `any` type — use `unknown` if needed

## Naming

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `memory-manager.ts` |
| Classes | PascalCase | `MemoryManager` |
| Functions | camelCase | `assessThreat` |
| Constants | UPPER_SNAKE | `MAX_RISK_SCORE` |
| Types | PascalCase | `AuditEvent` |

## Formatting

- 2-space indent
- Single quotes
- Semicolons required
- Trailing commas in multi-line
- ESM imports with `.js` extensions

## Types

- Explicit types for function params and returns
- Use `unknown` over `any`
- Zod schemas for runtime validation
