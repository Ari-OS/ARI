# API Keys Setup

## Required Environment Variables

Location: `~/.ari/.env`

```bash
# REQUIRED — ARI cannot make AI calls without this
ANTHROPIC_API_KEY=sk-ant-api03-...

# REQUIRED — Telegram bot communication
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_OWNER_USER_ID=your-user-id

# OPTIONAL — For embeddings (RAG system)
OPENAI_API_KEY=sk-...

# OPTIONAL — For Gemini Flash routing (cheapest quality model)
GEMINI_API_KEY=...

# OPTIONAL — For X/Twitter intelligence scanning
TWITTER_BEARER_TOKEN=...
```

## How to Get Each Key

### Anthropic API Key
1. Go to https://console.anthropic.com
2. Create account (separate from Claude Max subscription)
3. Go to API Keys → Create Key
4. Copy the key starting with `sk-ant-`
5. Add $20 credits to start

### Telegram Bot Token (Already Set)
- Bot: @ari_pryce_bot
- Token and User ID should already be in `~/.ari/.env`

### OpenAI API Key (Optional)
1. Go to https://platform.openai.com
2. API Keys → Create new secret key
3. Used for: text-embedding-3-small (RAG system)
4. Cost: ~$0.02 per 1M tokens (very cheap)

### Gemini API Key (Optional)
1. Go to https://aistudio.google.com/apikey
2. Create API key
3. Used for: Gemini 2.5 Flash routing ($0.30/1M input)

## Verify Keys Work

```bash
# On Mac Mini
cd /Users/ari/ARI
npx ari doctor  # Checks all configured providers
npx ari provider list  # Shows available providers
```
