# Apex Enterprise Playbook (V10) - System Setup Guide

This guide outlines the complete setup requirements for Pryceless Solutions and Trading Trail under the new V10 Apex Enterprise Playbook architecture. All of these components are necessary to fully activate the new AI-powered systems.

## 1. CRM & Lead Pipeline (HubSpot & Smartlead)

### HubSpot (Free Tier)
1. **Create Account:** Sign up for a free HubSpot CRM account.
2. **Generate API Key:** Go to Settings > Integrations > API Key and create a new Private App with Contacts, Deals, and Pipeline scopes.
3. **Environment Variable:** Add the key to ARI's `.env`:
   ```env
   HUBSPOT_API_KEY="your-hubspot-api-key"
   ```
4. **Pipeline Setup:** Ensure your HubSpot pipeline has the following exact stages to match ARI's synchronization:
   - `PROSPECT`
   - `OUTREACH_ACTIVE`
   - `REPLIED`
   - `CALL_BOOKED`
   - `PROPOSAL_SENT`
   - `CLIENT`
   - `RETAINER`

### Smartlead (Outbound Email)
1. **Setup Sequences:** Create the 3-email sequence designed in the playbook.
2. **Webhook Configuration:** In Smartlead Campaign settings, configure a webhook to trigger on "Reply Received".
   - **URL:** `https://your-ari-domain.com/webhooks/smartlead/reply` (Use Ngrok/Cloudflare tunnel if hosting ARI locally).
   - **Method:** POST

## 2. Lead Generation (Apollo.io / Clay.com)

1. **Configure Search Parameters:** Set up searches targeting Southern Indiana regions (Loogootee, Evansville, Bloomington, Vincennes, Washington, Jasper, Bedford).
2. **Tech Stack Filters:** Filter targets by legacy technologies (e.g., WordPress 4, Wix, Squarespace, HTTP/No SSL).
3. **Export/API:** Export these leads and feed them into the Smartlead campaign. (ARI's Growth Pod will simulate or automate this ingestion).

## 3. prycehedrick.com Website Setup (Vercel)

The new Next.js 15 App Router website is located in the `/website` directory.
1. **Install Dependencies:**
   ```bash
   cd website
   npm install
   ```
2. **Local Testing:**
   ```bash
   npm run dev
   ```
3. **Deployment (Vercel):**
   - Connect your GitHub repository to Vercel.
   - Set the Root Directory to `website`.
   - Ensure the Build Command is `npm run build` and Output Directory is `.next`.
   - Add your custom domain (`prycehedrick.com`).

## 4. Payment Infrastructure (Stripe)

1. **Create Products/Prices:** In the Stripe Dashboard, create the following payment links:
   - **One-Time:** Starter ($997), Growth ($2,200), System ($4,500)
   - **Monthly Retainers:** Essential Care ($249/mo), Smart Growth ($499/mo), Total Partner ($999/mo)
2. **Update Website:** Add these Stripe Payment Links to the corresponding buttons on the `/pricing` page in the `website` project.

## 5. Contract Automation (DocuSign)

1. **Templates:** Create standard templates for the Starter, Growth, and System packages, as well as Retainer agreements.
2. **Integration (Optional for now):** ARI can eventually trigger these via DocuSign API once a deal reaches `PROPOSAL_SENT`.

## 6. Trading Trail (Content Production)

1. **AI Model Roles:** ARI is pre-configured. Ensure you have valid API keys for both Anthropic (Claude) and Google (Gemini) in your `.env`:
   ```env
   ANTHROPIC_API_KEY="your-claude-key"
   GEMINI_API_KEY="your-gemini-key"
   ```
   *Claude handles strategy, Gemini handles script generation.*

## 7. Telegram Universal Command Center

1. **Bot Setup:** Ensure your Telegram Bot Token is valid.
2. **Commands to use:**
   - `/growth digest`: View morning digest and approve outreach.
   - `/growth replies`: View pending Smartlead replies and approve ARI's suggested responses.
   - `/market`: Trigger Trading Trail analysis.

## 8. Verification

After completing the setup:
1. Run `npm test` in the ARI root directory to ensure the core system is healthy.
2. Monitor the `terminals` and `logs` to ensure the `Growth Pod` and `Production Pod` are actively executing their cron jobs.