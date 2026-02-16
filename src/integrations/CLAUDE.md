# Integrations Layer

External service integrations for ARI. 21 integration directories.

## Components

| Integration | Purpose | API Key Required |
|-------------|---------|-----------------|
| anki/ | Spaced repetition flashcards | No (local) |
| apple/ | Calendar, Reminders, Focus Mode | No (AppleScript) |
| calcom/ | Scheduling and bookings | Yes |
| cowork/ | Claude Cowork plugin generation | No |
| github/ | Repository and PR monitoring | Yes |
| hackernews/ | Tech news aggregation | No |
| notion/ | Task and document management | Yes |
| ollama/ | Local LLM inference | No (local) |
| perplexity/ | AI-powered research | Yes |
| producthunt/ | Product launch tracking | Yes |
| readwise/ | Reading highlights sync | Yes |
| rss/ | RSS feed aggregation | No |
| sms/ | Mobile notifications | Yes |
| spotify/ | Music and podcast tracking | Yes |
| stripe/ | Payment and revenue monitoring | Yes |
| telegram/ | Bot and messaging | Yes |
| toggl/ | Time tracking | Yes |
| trends/ | Google Trends monitoring | No |
| twitter/ | Social media monitoring | Yes |
| weather/ | Weather forecasts | Yes |
| whisper/ | Speech-to-text transcription | No (local) |

## Notion Integration

```typescript
import { NotionClient } from './integrations/notion';

const notion = new NotionClient(process.env.NOTION_API_KEY);
await notion.createPage({ title: 'ARI Task', content: '...' });
```

## Security

- API keys stored in environment variables
- All integrations log to audit trail
- Trust levels propagated to external calls

Skills: `/ari-cowork-plugin`
