# Prompts Layer

Prompt building utilities for AI interactions.

## Components

| Component | Purpose |
|-----------|---------|
| prompt-builder.ts | Prompt construction utilities |

## Usage

```typescript
import { PromptBuilder } from './prompts';

const prompt = new PromptBuilder()
  .system('You are ARI, a helpful assistant.')
  .user('What is the status?')
  .context({ tasks: 5, pending: 2 })
  .build();
```

## Best Practices

- Keep prompts focused and specific
- Include relevant context
- Use consistent formatting
- Avoid prompt injection patterns
