# ═══════════════════════════════════════════════════════════════
# ARI Environment Variables Template
# Copy to ~/.ari/.env and fill in actual values
# ═══════════════════════════════════════════════════════════════

# === CRITICAL (required for daemon to start) ===
ANTHROPIC_API_KEY=sk-ant-...
ARI_API_KEY=1fe...
TELEGRAM_BOT_TOKEN=858...
TELEGRAM_OWNER_USER_ID=776...
TELEGRAM_ALLOWED_USER_IDS=776...

# === NOTION (task management, daily logs, inbox) ===
# Get from: https://www.notion.so/my-integrations
NOTION_API_KEY=ntn_...
NOTION_INBOX_DATABASE_ID=
NOTION_DAILY_LOG_PARENT_ID=
NOTION_TASKS_DATABASE_ID=

# === X/TWITTER (content publishing + intelligence) ===
# Get from: https://developer.x.com/en/portal/dashboard
X_BEARER_TOKEN=AAAA...
X_USER_ID=

# === MARKET DATA ===
# Alpha Vantage: https://www.alphavantage.co/support/#api-key
ALPHA_VANTAGE_API_KEY=
# CoinGecko: https://www.coingecko.com/en/api/pricing
COINGECKO_API_KEY=CG-...

# === AI PROVIDERS ===
# OpenAI (Whisper voice + GPT fallback): https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...
# Google AI (Gemini fallback): https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=AIza...
# xAI (Grok fallback): https://console.x.ai
XAI_API_KEY=xai-...

# === INTEGRATIONS ===
# GitHub: https://github.com/settings/tokens (scopes: repo, read:org)
GITHUB_TOKEN=ghp_...
# Weather: https://openweathermap.org/api
WEATHER_API_KEY=
WEATHER_LOCATION=Indianapolis, IN
# Perplexity: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=pplx-...
# ElevenLabs: https://elevenlabs.io (Profile → API Key)
ELEVENLABS_API_KEY=sk_...

# === GMAIL (Phase 8 — optional for now) ===
# Gmail App Password: https://myaccount.google.com/apppasswords
# GMAIL_EMAIL=
# GMAIL_APP_PASSWORD=

# === SETTINGS ===
ARI_LOG_LEVEL=info
NODE_ENV=production
