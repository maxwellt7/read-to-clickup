# Read.ai → ClickUp Sync Engine

Automatically syncs Read.ai meeting transcripts into ClickUp, using Claude AI to classify calls and extract action items.

## How it works

1. A meeting ends in Read.ai → webhook fires to this server
2. Claude Haiku classifies the call type (leadership, sales, ops, etc.)
3. Claude Sonnet extracts summary, decisions, and action items
4. A ClickUp Doc is created in the correct space (LEADERSHIP, Operations, etc.)
5. ClickUp Tasks are created for each action item, assigned to the right team member
6. ClickUp Brain can now query all call notes by type

## Call Type Routing

| Type | ClickUp Space |
|------|--------------|
| leadership | LEADERSHIP |
| sales | Acquisition Systems |
| operations | Operations |
| creative | Creative |
| admin | ADMIN |
| hr | Resources & Trainings |
| client | GROWTHGOD / Client Calls |
| general | GROWTHGOD / Meeting Notes |

## Setup

### 1. Clone and install

```bash
git clone https://github.com/maxwellt7/read-to-clickup.git
cd read-to-clickup
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in all values in .env.local
```

Required variables:
- `READ_AI_API_KEY` — from Read.ai Settings → Developer
- `READ_AI_WEBHOOK_SECRET` — set this when registering the webhook in Read.ai
- `CLICKUP_API_KEY` — your ClickUp personal API token
- `CLICKUP_TEAM_ID` — `9006105068` (GrowthGod workspace)
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` — from Vercel KV dashboard

### 3. Scaffold ClickUp workspace (run once)

```bash
npm run setup-clickup
```

This creates folders, lists, and custom fields in your ClickUp workspace.

### 4. Deploy to Vercel

```bash
vercel --prod
```

Set all environment variables in the Vercel dashboard. Add a KV storage integration.

### 5. Register webhook in Read.ai

Go to Read.ai → Settings → Integrations → Webhooks and add:
- **URL:** `https://your-app.vercel.app/api/webhook/read-ai`
- **Events:** `meeting.completed`
- **Secret:** same value as `READ_AI_WEBHOOK_SECRET`

### 6. Verify

```bash
curl https://your-app.vercel.app/api/health
# → {"status":"ok","timestamp":"...","service":"read-to-clickup"}
```

## Development

```bash
npm run dev        # Local dev server
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Architecture

```
Read.ai → POST /api/webhook/read-ai
         → Verify HMAC signature
         → Dedup check (Vercel KV)
         → Fetch transcript (Read.ai API)
         → Classify call type (Claude Haiku)
         → Extract intelligence (Claude Sonnet)
         → Create ClickUp Doc + Tasks
         → Mark as processed (Vercel KV)
```

## Error handling

- Invalid signature → 401
- Already processed → 200 (skipped)
- Pipeline failure → 500 with error details in response body
- Low confidence classification (< 0.7) → stored in both best-guess space AND Needs Review list
