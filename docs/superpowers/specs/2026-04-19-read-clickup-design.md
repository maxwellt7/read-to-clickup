# Read.ai → ClickUp Sync Engine — Design Spec

**Date:** 2026-04-19  
**Status:** Approved  
**Repo:** https://github.com/maxwellt7/read-to-clickup  
**Deployment:** Vercel (serverless)  
**Primary ClickUp Workspace:** GrowthGod (id: 9006105068)

---

## Overview

A serverless webhook pipeline that receives Read.ai meeting-completed events, uses Claude AI to classify and extract structured intelligence from the transcript, and stores the results in the appropriate ClickUp space as a Doc (for ClickUp Brain indexing) and Tasks (for actionable follow-up).

The system handles all calls — internal team calls, client calls, sales calls — and intelligently routes each one to the correct ClickUp space based on call type, keeping leadership, sales, operations, and other functions in separate, permission-controlled spaces that ClickUp Brain can query independently.

---

## Architecture

### Data Flow

```
Read.ai meeting ends
       │
       ▼
POST /api/webhook/read-ai   (Vercel Serverless Function)
       │
       ├─ Verify HMAC signature → 401 if invalid
       ├─ Check Vercel KV (dedup by meeting_id) → 200 OK if already processed
       │
       ▼
Fetch full transcript from Read.ai API
       │
       ▼
Claude Haiku — Call Classifier
  Input:  meeting title + participant names/emails + first 500 words
  Output: { call_type, confidence, suggested_title }
       │
       ▼
Claude Sonnet — Deep Extractor
  Input:  full transcript + call_type context
  Output: {
    summary: string[]          // 3–5 bullet points
    key_decisions: string[]
    action_items: {
      task: string
      assignee: string         // raw name from transcript
      due_hint: string | null  // "by Friday", "end of month", etc.
    }[]
    participants: {
      name: string
      role: string             // inferred from context
    }[]
    sentiment: "positive" | "neutral" | "negative" | "mixed"
    topics: string[]
  }
       │
       ▼
ClickUp Router
  Maps call_type → GrowthGod Space + Folder + List
       │
       ├─ Create ClickUp Doc (AI summary + full transcript)
       └─ Create ClickUp Tasks (one per action item)
       │
       ▼
Mark meeting_id in Vercel KV (TTL: 30 days)
Return 200 OK
```

---

## Call Type → ClickUp Space Routing

| Call Type | Detection Signals | ClickUp Space | Folder | List |
|-----------|-------------------|---------------|--------|------|
| `leadership` | Exec/owner titles, strategy/vision topics, OKR language | LEADERSHIP (901312664119) | Meeting Notes | Leadership Calls |
| `sales` | Prospect names, deal/pipeline language, pricing, proposals | Acquisition Systems (901312939631) | Call Notes | Sales Calls |
| `operations` | Ops team members, SOPs, process reviews, execution | Operations (90131759723) | Meeting Notes | Ops Calls |
| `creative` | Design, copy, ads, creative briefs, brand | Creative (901311249959) | Meeting Notes | Creative Calls |
| `admin` | Finance, compliance, HR admin, internal processes | ADMIN (901312664105) | Meeting Notes | Admin Calls |
| `hr` | Hiring, performance reviews, team culture, onboarding | Resources & Trainings (90131759721) | HR Calls | All HR Calls |
| `client` | External client/customer names not on the team | GROWTHGOD (901312664037) | Client Calls | Client Calls |
| `general` | Catch-all — none of the above clearly apply | GROWTHGOD (901312664037) | Meeting Notes | General Calls |

Classification uses confidence scoring. If confidence < 0.7, the call is tagged `#needs-review` and stored in GROWTHGOD/Meeting Notes while also being routed to the best-guess space.

---

## ClickUp Document Structure

Each processed call creates one Doc with this structure:

```
📋 [LEADERSHIP] Strategy Review — April 2026

📎 Read.ai Recording | Duration: 45m | Sentiment: Positive
👥 Max Mayes (Owner), Jane Smith (COO), John Doe (Ops Lead)
📅 April 19, 2026 | 10:00 AM EST

---

## Summary
- Discussed Q2 growth targets and resource allocation
- Agreed to hire 2 senior engineers by end of May
- Operations restructure to proceed in phases

## Key Decisions
- Budget approved for new hires
- Marketing freeze lifted after May 1

## Action Items
| Task | Owner | Due |
|------|-------|-----|
| Post job listings | Jane | End of week |
| Draft ops restructure plan | John | April 25 |

## Participants
- Max Mayes — Owner / Strategic lead
- Jane Smith — COO
- John Doe — Operations Lead

---

## Full Transcript
[Complete verbatim transcript from Read.ai]
```

---

## ClickUp Task Structure

For each action item extracted, a Task is created in the same List as the Doc:

- **Title:** action item text
- **Assignee:** matched to ClickUp member by name lookup (fuzzy match)
- **Due date:** parsed from `due_hint` if deterministic, otherwise left blank
- **Tags:** `#from-read-ai`, `#[call-type]`
- **Description:** link to parent Doc + context sentence from transcript
- **Custom field:** `Meeting Date`, `Call Type`, `Read.ai Link`

Unmatched assignees → task created unassigned + tagged `#needs-assignment`.

---

## Project Structure

```
read-to-clickup/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── webhook/
│   │       │   └── read-ai/
│   │       │       └── route.ts          # Webhook receiver + pipeline orchestrator
│   │       └── health/
│   │           └── route.ts              # Health check endpoint
│   └── lib/
│       ├── read-ai/
│       │   ├── client.ts                 # Read.ai REST API client
│       │   ├── types.ts                  # Webhook payload + transcript types
│       │   └── verify.ts                 # HMAC-SHA256 signature verification
│       ├── classifier/
│       │   ├── index.ts                  # Claude Haiku call classifier
│       │   ├── extractor.ts              # Claude Sonnet deep extractor
│       │   └── prompts.ts                # Prompt templates
│       ├── clickup/
│       │   ├── client.ts                 # ClickUp REST API client (rate-limit aware)
│       │   ├── router.ts                 # call_type → Space/Folder/List resolver
│       │   ├── docs.ts                   # Doc creation + formatting
│       │   ├── tasks.ts                  # Task creation + member matching
│       │   ├── members.ts                # ClickUp member name → ID cache
│       │   └── setup.ts                  # One-time workspace setup (folders/lists/fields)
│       ├── kv.ts                         # Vercel KV wrapper (dedup + caching)
│       └── pipeline.ts                   # Main orchestration: classify → extract → store
├── scripts/
│   └── setup-clickup.ts                  # Run once: scaffold ClickUp structure
├── tests/
│   ├── classifier.test.ts
│   ├── extractor.test.ts
│   ├── router.test.ts
│   ├── webhook.test.ts
│   └── fixtures/
│       ├── sample-transcript.ts
│       └── sample-webhook.ts
├── docs/
│   └── superpowers/specs/
│       └── 2026-04-19-read-clickup-design.md
├── .env.example
├── .env.local                            # gitignored
├── next.config.ts
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

---

## Environment Variables

```bash
# Read.ai
READ_AI_API_KEY=                   # Read.ai API key for fetching transcripts
READ_AI_WEBHOOK_SECRET=            # HMAC secret for webhook signature verification

# ClickUp
CLICKUP_API_KEY=pk_63069131_...    # ClickUp personal API token
CLICKUP_TEAM_ID=9006105068         # GrowthGod workspace

# Anthropic
ANTHROPIC_API_KEY=                 # Claude API key

# Vercel KV
KV_REST_API_URL=                   # Auto-injected by Vercel KV integration
KV_REST_API_TOKEN=                 # Auto-injected by Vercel KV integration
```

---

## Error Handling

| Failure | Behavior |
|---------|----------|
| Invalid webhook signature | 401 response, log to Vercel |
| Duplicate meeting_id | 200 OK, skip silently |
| Read.ai API unreachable | Retry 3x with exponential backoff; on final failure, create a Task in ADMIN/Meeting Notes tagged `#sync-failed` with meeting details |
| Claude API failure | Fallback: store raw transcript as `[UNCLASSIFIED]` Doc in GROWTHGOD/Meeting Notes |
| ClickUp API failure | Retry 3x; on final failure, log full payload to Vercel function logs |
| No ClickUp member match for assignee | Create task unassigned, tag `#needs-assignment` |
| Classification confidence < 0.7 | Route to best-guess space AND GROWTHGOD/Meeting Notes, tag `#needs-review` |

---

## One-Time ClickUp Setup (setup-clickup.ts script)

Run once before first webhook arrives. Creates:

1. **Folders** in each target space: "Meeting Notes" (or "Call Notes", "HR Calls", "Client Calls")
2. **Lists** within each folder (e.g., "Leadership Calls", "Sales Calls")
3. **Custom Fields** on each list:
   - `Meeting Date` (date)
   - `Call Type` (dropdown: leadership, sales, operations, creative, admin, hr, client, general)
   - `Read.ai Link` (url)
   - `Duration` (text)
   - `Sentiment` (dropdown: positive, neutral, negative, mixed)
   - `AI Confidence` (number)

---

## Testing Strategy

- **Unit tests:** classifier routing logic, prompt construction, ClickUp router mapping
- **Integration tests:** full pipeline with fixture transcripts (3 sample transcripts covering different call types)
- **Webhook simulation:** test harness that fires mock Read.ai payloads locally
- **Setup script validation:** dry-run mode that checks ClickUp structure without creating anything

---

## Deployment

1. Push to `main` → Vercel auto-deploys
2. Set environment variables in Vercel dashboard
3. Add `KV` storage integration in Vercel project settings
4. Run `npx ts-node scripts/setup-clickup.ts` once to scaffold ClickUp
5. Register Vercel deployment URL as Read.ai webhook endpoint in Read.ai settings
6. Verify with a test meeting

---

## Out of Scope (v1)

- Multi-workspace routing (beyond GrowthGod)
- Slack notifications on sync
- Dashboard/UI for reviewing synced calls
- Custom classification training
- Video summary storage
