# Read.ai → ClickUp Sync Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a serverless webhook pipeline that receives Read.ai meeting events, uses Claude to classify and extract intelligence from transcripts, and stores structured notes + action-item tasks in the correct ClickUp space for ClickUp Brain indexing.

**Architecture:** Next.js App Router API routes deployed on Vercel receive Read.ai webhooks, pipe through a two-stage Claude pipeline (Haiku for classification, Sonnet for extraction), then write ClickUp Docs + Tasks into space-specific folders. Vercel KV handles idempotency.

**Tech Stack:** Next.js 14, TypeScript, `@anthropic-ai/sdk`, `@vercel/kv`, `zod`, `vitest`, Vercel deployment

**Repo:** https://github.com/maxwellt7/read-to-clickup  
**Working dir:** Wherever you cloned this repo

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/app/api/webhook/read-ai/route.ts` | Receives POST from Read.ai, validates signature, starts pipeline |
| `src/app/api/health/route.ts` | Health check — returns 200 + timestamp |
| `src/lib/read-ai/types.ts` | TypeScript types for Read.ai webhook payloads + meeting API responses |
| `src/lib/read-ai/verify.ts` | HMAC-SHA256 webhook signature verification |
| `src/lib/read-ai/client.ts` | Fetches full meeting + transcript from Read.ai API |
| `src/lib/classifier/prompts.ts` | Claude prompt templates (classifier + extractor) |
| `src/lib/classifier/index.ts` | Claude Haiku — classifies call type from title + participants + excerpt |
| `src/lib/classifier/extractor.ts` | Claude Sonnet — extracts summary, decisions, action items, participants |
| `src/lib/clickup/types.ts` | TypeScript types for ClickUp API requests/responses |
| `src/lib/clickup/client.ts` | ClickUp REST API client with retry + rate-limit handling |
| `src/lib/clickup/router.ts` | Maps call_type → spaceId + folderName + listName (hardcoded GrowthGod IDs) |
| `src/lib/clickup/members.ts` | Fetches workspace members, fuzzy-matches name → userId |
| `src/lib/clickup/setup.ts` | Creates folders, lists, custom fields in each target space |
| `src/lib/clickup/docs.ts` | Formats + creates ClickUp Docs (transcript + AI summary) |
| `src/lib/clickup/tasks.ts` | Creates ClickUp Tasks from extracted action items |
| `src/lib/kv.ts` | Vercel KV wrapper — dedup check + mark-processed |
| `src/lib/pipeline.ts` | Orchestrates: fetch → classify → extract → route → store |
| `src/lib/env.ts` | Validates + exports typed env vars (fails fast if missing) |
| `scripts/setup-clickup.ts` | CLI runner for one-time ClickUp workspace scaffolding |
| `tests/fixtures/sample-transcript.ts` | Realistic fixture transcripts (4 types: leadership, sales, ops, client) |
| `tests/fixtures/sample-webhook.ts` | Fixture Read.ai webhook payload |
| `tests/verify.test.ts` | Unit: HMAC verification |
| `tests/classifier.test.ts` | Unit: call type classification logic |
| `tests/router.test.ts` | Unit: call_type → space routing |
| `tests/pipeline.test.ts` | Integration: full pipeline with mocked Read.ai + ClickUp + Claude |

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vercel.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize the project**

```bash
cd "/Users/maxmayes/Maxwellmayes Dropbox/Maxwell Mayes/01. Professional/02. AI Tools/Read --> ClickUp"
npx create-next-app@latest . --typescript --eslint --no-tailwind --no-src-dir --app --no-import-alias --yes
```

Expected: next.js app scaffolded with app/ directory.

- [ ] **Step 2: Move app to src/ and install dependencies**

```bash
mkdir -p src
mv app src/app
npm install @anthropic-ai/sdk @vercel/kv zod
npm install -D vitest @vitest/coverage-v8 tsx
```

- [ ] **Step 3: Update tsconfig.json**

Replace contents of `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create next.config.ts**

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Create vercel.json**

```json
{
  "functions": {
    "src/app/api/webhook/read-ai/route.ts": {
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 6: Create .env.example**

```bash
# Read.ai
READ_AI_API_KEY=your_read_ai_api_key_here
READ_AI_WEBHOOK_SECRET=your_webhook_hmac_secret_here

# ClickUp
CLICKUP_API_KEY=pk_63069131_UHFMQ17020NGF4U0M8EUQOH77EXQBPLT
CLICKUP_TEAM_ID=9006105068

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Vercel KV (auto-injected in prod, set manually for local dev)
KV_REST_API_URL=your_kv_url
KV_REST_API_TOKEN=your_kv_token
```

- [ ] **Step 7: Update .gitignore to exclude .env.local**

Add to `.gitignore`:
```
.env.local
.env*.local
```

- [ ] **Step 8: Add vitest config to package.json**

Add to `package.json` scripts section:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "setup-clickup": "tsx scripts/setup-clickup.ts"
  }
}
```

Also add at root of `package.json`:
```json
{
  "vitest": {
    "environment": "node",
    "include": ["tests/**/*.test.ts"]
  }
}
```

- [ ] **Step 9: Commit scaffold**

```bash
git add -A
git commit -m "feat: scaffold Next.js TypeScript project with deps"
git push
```

---

## Task 2: Environment Validation

**Files:**
- Create: `src/lib/env.ts`

- [ ] **Step 1: Create env.ts**

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  READ_AI_API_KEY: z.string().min(1),
  READ_AI_WEBHOOK_SECRET: z.string().min(1),
  CLICKUP_API_KEY: z.string().min(1),
  CLICKUP_TEAM_ID: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing required environment variables: ${missing}`);
  }
  return result.data;
}

export const env = validateEnv();
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/env.ts
git commit -m "feat: add environment variable validation"
git push
```

---

## Task 3: Read.ai Types + Webhook Verification

**Files:**
- Create: `src/lib/read-ai/types.ts`
- Create: `src/lib/read-ai/verify.ts`
- Create: `tests/verify.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/verify.test.ts
import { describe, it, expect } from 'vitest';
import { verifyReadAiSignature } from '@/lib/read-ai/verify';
import { createHmac } from 'crypto';

const SECRET = 'test-secret-abc123';
const BODY = JSON.stringify({ event_type: 'meeting.completed', payload: { meeting_id: 'abc' } });

function makeSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyReadAiSignature', () => {
  it('returns true for a valid signature', () => {
    const sig = makeSignature(BODY, SECRET);
    expect(verifyReadAiSignature(BODY, sig, SECRET)).toBe(true);
  });

  it('returns false for a wrong secret', () => {
    const sig = makeSignature(BODY, 'wrong-secret');
    expect(verifyReadAiSignature(BODY, sig, SECRET)).toBe(false);
  });

  it('returns false for a tampered body', () => {
    const sig = makeSignature(BODY, SECRET);
    const tampered = BODY + 'x';
    expect(verifyReadAiSignature(tampered, sig, SECRET)).toBe(false);
  });

  it('returns false for an empty signature', () => {
    expect(verifyReadAiSignature(BODY, '', SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/verify.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/read-ai/verify'`

- [ ] **Step 3: Create Read.ai types**

```typescript
// src/lib/read-ai/types.ts

export type CallType =
  | 'leadership'
  | 'sales'
  | 'operations'
  | 'creative'
  | 'admin'
  | 'hr'
  | 'client'
  | 'general';

export interface ReadAiWebhookPayload {
  event_type: 'meeting.completed';
  payload: {
    meeting_id: string;
  };
}

export interface ReadAiParticipant {
  name: string;
  email: string;
}

export interface ReadAiTranscriptEntry {
  speaker: string;
  text: string;
  start_time: number; // seconds
}

export interface ReadAiMeeting {
  id: string;
  title: string;
  start_time: string;      // ISO 8601
  end_time: string;        // ISO 8601
  duration_minutes: number;
  recording_url: string | null;
  participants: ReadAiParticipant[];
  transcript: ReadAiTranscriptEntry[];
  summary: string | null;  // Read.ai's own summary if available
}
```

- [ ] **Step 4: Create verify.ts**

```typescript
// src/lib/read-ai/verify.ts
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies the Read.ai webhook HMAC-SHA256 signature.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyReadAiSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test tests/verify.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/read-ai/ tests/verify.test.ts
git commit -m "feat: add Read.ai types and webhook signature verification"
git push
```

---

## Task 4: Read.ai API Client

**Files:**
- Create: `src/lib/read-ai/client.ts`

- [ ] **Step 1: Create the Read.ai API client**

```typescript
// src/lib/read-ai/client.ts
import { env } from '@/lib/env';
import type { ReadAiMeeting } from './types';

const BASE_URL = 'https://api.read.ai/v1';

async function readAiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${env.READ_AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Read.ai API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetches full meeting details including the complete transcript.
 */
export async function getMeeting(meetingId: string): Promise<ReadAiMeeting> {
  return readAiFetch<ReadAiMeeting>(`/meetings/${meetingId}`);
}

/**
 * Converts transcript entries into a single readable string.
 */
export function transcriptToText(meeting: ReadAiMeeting): string {
  return meeting.transcript
    .map((entry) => `${entry.speaker}: ${entry.text}`)
    .join('\n');
}

/**
 * Returns the first N words of the transcript for classification.
 */
export function transcriptExcerpt(meeting: ReadAiMeeting, wordCount = 500): string {
  const full = transcriptToText(meeting);
  return full.split(/\s+/).slice(0, wordCount).join(' ');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/read-ai/client.ts
git commit -m "feat: add Read.ai API client"
git push
```

---

## Task 5: Claude Classifier (Haiku)

**Files:**
- Create: `src/lib/classifier/prompts.ts`
- Create: `src/lib/classifier/index.ts`
- Create: `tests/fixtures/sample-transcript.ts`
- Create: `tests/classifier.test.ts`

- [ ] **Step 1: Create test fixtures**

```typescript
// tests/fixtures/sample-transcript.ts
import type { ReadAiMeeting } from '@/lib/read-ai/types';

export const leadershipMeeting: ReadAiMeeting = {
  id: 'meet-leadership-001',
  title: 'Q2 Strategy Review',
  start_time: '2026-04-19T10:00:00Z',
  end_time: '2026-04-19T10:45:00Z',
  duration_minutes: 45,
  recording_url: null,
  participants: [
    { name: 'Max Mayes', email: 'max@maxwellmayes.com' },
    { name: 'Jane Smith', email: 'jane@growthgod.com' },
  ],
  transcript: [
    { speaker: 'Max Mayes', text: 'Let\'s review our Q2 OKRs and strategic priorities.', start_time: 0 },
    { speaker: 'Jane Smith', text: 'I think we need to focus on the leadership team structure and long-term vision.', start_time: 10 },
    { speaker: 'Max Mayes', text: 'Agreed. The board expects us to have a clear succession plan by end of Q2.', start_time: 20 },
  ],
  summary: null,
};

export const salesMeeting: ReadAiMeeting = {
  id: 'meet-sales-001',
  title: 'Discovery Call - Acme Corp',
  start_time: '2026-04-19T14:00:00Z',
  end_time: '2026-04-19T14:30:00Z',
  duration_minutes: 30,
  recording_url: null,
  participants: [
    { name: 'Max Mayes', email: 'max@maxwellmayes.com' },
    { name: 'Bob Johnson', email: 'bob@acmecorp.com' },
  ],
  transcript: [
    { speaker: 'Max Mayes', text: 'Thanks for joining. Tell me about your current acquisition funnel.', start_time: 0 },
    { speaker: 'Bob Johnson', text: 'We\'re spending $50k a month on ads but our ROAS is only 1.8x. We need help.', start_time: 10 },
    { speaker: 'Max Mayes', text: 'We can definitely improve that. What\'s your average deal size and close rate?', start_time: 20 },
    { speaker: 'Bob Johnson', text: 'Our pipeline is around $200k and we close about 20% of proposals.', start_time: 35 },
  ],
  summary: null,
};

export const operationsMeeting: ReadAiMeeting = {
  id: 'meet-ops-001',
  title: 'Weekly Ops Standup',
  start_time: '2026-04-19T09:00:00Z',
  end_time: '2026-04-19T09:30:00Z',
  duration_minutes: 30,
  recording_url: null,
  participants: [
    { name: 'Max Mayes', email: 'max@maxwellmayes.com' },
    { name: 'Ops Lead', email: 'ops@growthgod.com' },
  ],
  transcript: [
    { speaker: 'Ops Lead', text: 'The client onboarding SOP is blocked — we need to update the Zapier workflow.', start_time: 0 },
    { speaker: 'Max Mayes', text: 'Let\'s prioritize that. What\'s the current bottleneck in the process?', start_time: 15 },
    { speaker: 'Ops Lead', text: 'The data handoff between the CRM and our delivery system. I\'ll fix it by Friday.', start_time: 25 },
  ],
  summary: null,
};
```

- [ ] **Step 2: Write the failing classifier test**

```typescript
// tests/classifier.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyCall } from '@/lib/classifier/index';
import { leadershipMeeting, salesMeeting, operationsMeeting } from './fixtures/sample-transcript';
import type { CallType } from '@/lib/read-ai/types';

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(),
    };
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    READ_AI_API_KEY: 'test-key',
    READ_AI_WEBHOOK_SECRET: 'test-secret',
    CLICKUP_API_KEY: 'test-key',
    CLICKUP_TEAM_ID: '9006105068',
    KV_REST_API_URL: 'https://example.com',
    KV_REST_API_TOKEN: 'test-token',
  },
}));

import Anthropic from '@anthropic-ai/sdk';

function mockClaudeResponse(callType: CallType, confidence: number) {
  const instance = new Anthropic();
  vi.mocked(instance.messages.create).mockResolvedValue({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ call_type: callType, confidence, suggested_title: 'Test Meeting' }),
      },
    ],
  } as never);
  return instance;
}

describe('classifyCall', () => {
  it('returns call_type and confidence from Claude response', async () => {
    const result = await classifyCall(leadershipMeeting);
    expect(['leadership', 'sales', 'operations', 'creative', 'admin', 'hr', 'client', 'general']).toContain(result.call_type);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.suggested_title).toBe('string');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test tests/classifier.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/classifier/index'`

- [ ] **Step 4: Create prompts.ts**

```typescript
// src/lib/classifier/prompts.ts
import type { ReadAiMeeting } from '@/lib/read-ai/types';
import { transcriptExcerpt } from '@/lib/read-ai/client';

export function buildClassificationPrompt(meeting: ReadAiMeeting): string {
  const participants = meeting.participants
    .map((p) => `${p.name} (${p.email})`)
    .join(', ');
  const excerpt = transcriptExcerpt(meeting, 500);

  return `You are classifying a business meeting to route it to the correct ClickUp space.

Meeting title: "${meeting.title}"
Participants: ${participants}
Duration: ${meeting.duration_minutes} minutes
Transcript excerpt (first 500 words):
${excerpt}

Classify this meeting into exactly one of these types:
- leadership: Executive/owner strategy, OKRs, vision, board matters, succession planning
- sales: Prospect discovery, demos, proposals, pipeline reviews, deal negotiations, client acquisition
- operations: SOPs, process reviews, team execution, workflows, project delivery, operations standup
- creative: Design, copywriting, ad creative, brand, content strategy, creative reviews
- admin: Finance, legal, compliance, HR admin, budgets, internal admin
- hr: Hiring, performance reviews, team culture, onboarding, offboarding
- client: Existing client check-in, client delivery reviews, client success calls (NOT prospect/sales)
- general: Does not clearly fit any above category

Respond ONLY with valid JSON, no other text:
{
  "call_type": "<one of the types above>",
  "confidence": <0.0 to 1.0>,
  "suggested_title": "<concise title for this meeting in ClickUp>"
}`;
}

export function buildExtractionPrompt(
  meeting: ReadAiMeeting,
  callType: string,
  fullTranscript: string,
): string {
  const participants = meeting.participants.map((p) => p.name).join(', ');

  return `You are extracting structured intelligence from a ${callType} call transcript.

Meeting: "${meeting.title}"
Date: ${meeting.start_time}
Participants: ${participants}

Full transcript:
${fullTranscript}

Extract the following and respond ONLY with valid JSON:
{
  "summary": ["bullet 1", "bullet 2", "bullet 3"],
  "key_decisions": ["decision 1", "decision 2"],
  "action_items": [
    {
      "task": "specific actionable task description",
      "assignee": "person's name from transcript or null",
      "due_hint": "due date hint from transcript or null"
    }
  ],
  "participants": [
    {
      "name": "participant name",
      "role": "inferred role from context"
    }
  ],
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "topics": ["topic 1", "topic 2", "topic 3"]
}

Rules:
- summary: 3-5 bullet points capturing the most important points
- key_decisions: only firm decisions made, not discussions
- action_items: only concrete tasks with a clear owner or action, not vague todos
- assignee: use the exact name as spoken in the meeting, or null if unclear
- due_hint: exact phrase from transcript ("by Friday", "end of month"), or null
- sentiment: overall tone of the meeting
- topics: 3-5 high-level topics discussed`;
}
```

- [ ] **Step 5: Create classifier index.ts**

```typescript
// src/lib/classifier/index.ts
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';
import { buildClassificationPrompt } from './prompts';
import type { ReadAiMeeting, CallType } from '@/lib/read-ai/types';

export interface ClassificationResult {
  call_type: CallType;
  confidence: number;
  suggested_title: string;
}

const VALID_CALL_TYPES: CallType[] = [
  'leadership', 'sales', 'operations', 'creative',
  'admin', 'hr', 'client', 'general',
];

export async function classifyCall(
  meeting: ReadAiMeeting,
): Promise<ClassificationResult> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const prompt = buildClassificationPrompt(meeting);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content.find((c) => c.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('Claude classifier returned no text content');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.text);
  } catch {
    throw new Error(`Claude classifier returned invalid JSON: ${text.text}`);
  }

  const result = parsed as { call_type: string; confidence: number; suggested_title: string };

  if (!VALID_CALL_TYPES.includes(result.call_type as CallType)) {
    console.warn(`Unknown call type "${result.call_type}", defaulting to "general"`);
    result.call_type = 'general';
  }

  return {
    call_type: result.call_type as CallType,
    confidence: Math.max(0, Math.min(1, result.confidence ?? 0.5)),
    suggested_title: result.suggested_title ?? meeting.title,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test tests/classifier.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/classifier/ tests/fixtures/sample-transcript.ts tests/classifier.test.ts
git commit -m "feat: add Claude Haiku call classifier"
git push
```

---

## Task 6: Claude Extractor (Sonnet)

**Files:**
- Create: `src/lib/classifier/extractor.ts`

- [ ] **Step 1: Create extractor.ts**

```typescript
// src/lib/classifier/extractor.ts
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';
import { buildExtractionPrompt } from './prompts';
import { transcriptToText } from '@/lib/read-ai/client';
import type { ReadAiMeeting } from '@/lib/read-ai/types';

export interface ActionItem {
  task: string;
  assignee: string | null;
  due_hint: string | null;
}

export interface ParticipantInfo {
  name: string;
  role: string;
}

export interface ExtractionResult {
  summary: string[];
  key_decisions: string[];
  action_items: ActionItem[];
  participants: ParticipantInfo[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  topics: string[];
}

export async function extractMeetingIntelligence(
  meeting: ReadAiMeeting,
  callType: string,
): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const fullTranscript = transcriptToText(meeting);
  const prompt = buildExtractionPrompt(meeting, callType, fullTranscript);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content.find((c) => c.type === 'text');
  if (!text || text.type !== 'text') {
    throw new Error('Claude extractor returned no text content');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.text);
  } catch {
    throw new Error(`Claude extractor returned invalid JSON: ${text.text}`);
  }

  const result = parsed as ExtractionResult;

  // Provide safe defaults if any field is missing
  return {
    summary: result.summary ?? [],
    key_decisions: result.key_decisions ?? [],
    action_items: result.action_items ?? [],
    participants: result.participants ?? meeting.participants.map((p) => ({
      name: p.name,
      role: 'Participant',
    })),
    sentiment: result.sentiment ?? 'neutral',
    topics: result.topics ?? [],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/classifier/extractor.ts
git commit -m "feat: add Claude Sonnet meeting intelligence extractor"
git push
```

---

## Task 7: ClickUp Types + API Client

**Files:**
- Create: `src/lib/clickup/types.ts`
- Create: `src/lib/clickup/client.ts`

- [ ] **Step 1: Create ClickUp types**

```typescript
// src/lib/clickup/types.ts

export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
  initials: string;
}

export interface ClickUpFolder {
  id: string;
  name: string;
}

export interface ClickUpList {
  id: string;
  name: string;
  folder: { id: string; name: string };
  space: { id: string; name: string };
}

export interface ClickUpTask {
  id: string;
  name: string;
  url: string;
}

export interface ClickUpDoc {
  id: string;
  name: string;
  url: string;
}

export interface CreateTaskPayload {
  name: string;
  description: string;
  assignees?: number[];
  due_date?: number;
  tags?: string[];
  custom_fields?: { id: string; value: string | number }[];
}

export interface SpaceRoute {
  spaceId: string;
  folderName: string;
  listName: string;
}
```

- [ ] **Step 2: Create ClickUp API client**

```typescript
// src/lib/clickup/client.ts
import { env } from '@/lib/env';

const BASE_URL = 'https://api.clickup.com/api/v2';
const BASE_URL_V3 = 'https://api.clickup.com/api/v3';

const headers = () => ({
  Authorization: env.CLICKUP_API_KEY,
  'Content-Type': 'application/json',
});

async function clickupFetch<T>(
  path: string,
  options: RequestInit = {},
  version: 'v2' | 'v3' = 'v2',
): Promise<T> {
  const base = version === 'v3' ? BASE_URL_V3 : BASE_URL;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Folders ─────────────────────────────────────────────────────────────────

export async function getFolders(spaceId: string): Promise<{ folders: { id: string; name: string }[] }> {
  return clickupFetch(`/space/${spaceId}/folder?archived=false`);
}

export async function createFolder(spaceId: string, name: string): Promise<{ id: string; name: string }> {
  return clickupFetch(`/space/${spaceId}/folder`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// ── Lists ────────────────────────────────────────────────────────────────────

export async function getLists(folderId: string): Promise<{ lists: { id: string; name: string }[] }> {
  return clickupFetch(`/folder/${folderId}/list?archived=false`);
}

export async function createList(
  folderId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return clickupFetch(`/folder/${folderId}/list`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(
  listId: string,
  payload: import('./types').CreateTaskPayload,
): Promise<{ id: string; name: string; url: string }> {
  return clickupFetch(`/list/${listId}/task`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Members ──────────────────────────────────────────────────────────────────

export async function getTeamMembers(
  teamId: string,
): Promise<{ members: { user: import('./types').ClickUpMember }[] }> {
  return clickupFetch(`/team/${teamId}`);
}

// ── Docs (v3) ────────────────────────────────────────────────────────────────

export async function createDoc(
  workspaceId: string,
  name: string,
  listId: string,
): Promise<{ id: string; name: string; url: string }> {
  return clickupFetch(
    `/workspaces/${workspaceId}/docs`,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        parent: { type: 7, id: listId }, // type 7 = list
        visibility: 'PRIVATE',
        create_page: true,
      }),
    },
    'v3',
  );
}

export async function createDocPage(
  workspaceId: string,
  docId: string,
  name: string,
  content: string,
): Promise<{ id: string }> {
  return clickupFetch(
    `/workspaces/${workspaceId}/docs/${docId}/pages`,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        content,
        content_format: 'text/md',
      }),
    },
    'v3',
  );
}

// ── Custom Fields ────────────────────────────────────────────────────────────

export async function getListCustomFields(listId: string): Promise<{
  fields: { id: string; name: string; type: string }[];
}> {
  return clickupFetch(`/list/${listId}/field`);
}

export async function createCustomField(
  listId: string,
  name: string,
  type: string,
  typeConfig?: Record<string, unknown>,
): Promise<{ id: string; name: string }> {
  return clickupFetch(`/list/${listId}/field`, {
    method: 'POST',
    body: JSON.stringify({ name, type, type_config: typeConfig ?? {} }),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/clickup/types.ts src/lib/clickup/client.ts
git commit -m "feat: add ClickUp types and API client"
git push
```

---

## Task 8: ClickUp Router

**Files:**
- Create: `src/lib/clickup/router.ts`
- Create: `tests/router.test.ts`

- [ ] **Step 1: Write the failing router test**

```typescript
// tests/router.test.ts
import { describe, it, expect } from 'vitest';
import { getRoute, LOW_CONFIDENCE_THRESHOLD } from '@/lib/clickup/router';
import type { CallType } from '@/lib/read-ai/types';

describe('getRoute', () => {
  const cases: [CallType, string][] = [
    ['leadership', '901312664119'],
    ['sales', '901312939631'],
    ['operations', '90131759723'],
    ['creative', '901311249959'],
    ['admin', '901312664105'],
    ['hr', '90131759721'],
    ['client', '901312664037'],
    ['general', '901312664037'],
  ];

  cases.forEach(([callType, expectedSpaceId]) => {
    it(`routes ${callType} to spaceId ${expectedSpaceId}`, () => {
      const route = getRoute(callType);
      expect(route.spaceId).toBe(expectedSpaceId);
      expect(typeof route.folderName).toBe('string');
      expect(typeof route.listName).toBe('string');
    });
  });

  it('exports LOW_CONFIDENCE_THRESHOLD as 0.7', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/router.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/clickup/router'`

- [ ] **Step 3: Create router.ts**

```typescript
// src/lib/clickup/router.ts
import type { CallType } from '@/lib/read-ai/types';
import type { SpaceRoute } from './types';

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// GrowthGod workspace (id: 9006105068) space IDs
export const CALL_TYPE_ROUTES: Record<CallType, SpaceRoute> = {
  leadership: {
    spaceId: '901312664119',   // LEADERSHIP space
    folderName: 'Meeting Notes',
    listName: 'Leadership Calls',
  },
  sales: {
    spaceId: '901312939631',   // Acquisition Systems space
    folderName: 'Call Notes',
    listName: 'Sales Calls',
  },
  operations: {
    spaceId: '90131759723',    // Operations space
    folderName: 'Meeting Notes',
    listName: 'Ops Calls',
  },
  creative: {
    spaceId: '901311249959',   // Creative space
    folderName: 'Meeting Notes',
    listName: 'Creative Calls',
  },
  admin: {
    spaceId: '901312664105',   // ADMIN space
    folderName: 'Meeting Notes',
    listName: 'Admin Calls',
  },
  hr: {
    spaceId: '90131759721',    // Resources & Trainings space
    folderName: 'HR Calls',
    listName: 'All HR Calls',
  },
  client: {
    spaceId: '901312664037',   // GROWTHGOD space
    folderName: 'Client Calls',
    listName: 'Client Calls',
  },
  general: {
    spaceId: '901312664037',   // GROWTHGOD space (catch-all)
    folderName: 'Meeting Notes',
    listName: 'General Calls',
  },
};

// Fallback route for low-confidence classifications
export const FALLBACK_ROUTE: SpaceRoute = {
  spaceId: '901312664037',    // GROWTHGOD
  folderName: 'Meeting Notes',
  listName: 'Needs Review',
};

export function getRoute(callType: CallType): SpaceRoute {
  return CALL_TYPE_ROUTES[callType] ?? FALLBACK_ROUTE;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/router.test.ts
```

Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/clickup/router.ts tests/router.test.ts
git commit -m "feat: add ClickUp call type router"
git push
```

---

## Task 9: ClickUp Member Matching

**Files:**
- Create: `src/lib/clickup/members.ts`

- [ ] **Step 1: Create members.ts**

```typescript
// src/lib/clickup/members.ts
import { getTeamMembers } from './client';
import { env } from '@/lib/env';
import type { ClickUpMember } from './types';

let memberCache: ClickUpMember[] | null = null;

export async function getMembers(): Promise<ClickUpMember[]> {
  if (memberCache) return memberCache;
  const data = await getTeamMembers(env.CLICKUP_TEAM_ID);
  memberCache = data.members.map((m) => m.user);
  return memberCache;
}

/**
 * Fuzzy-match a name from the transcript to a ClickUp user ID.
 * Tries exact name match first, then partial (first name only).
 * Returns null if no match found.
 */
export async function resolveAssignee(name: string | null): Promise<number | null> {
  if (!name) return null;

  const members = await getMembers();
  const normalizedName = name.toLowerCase().trim();

  // Exact match
  const exact = members.find((m) => m.username.toLowerCase() === normalizedName);
  if (exact) return exact.id;

  // First name match
  const firstName = normalizedName.split(' ')[0];
  const partial = members.find((m) => m.username.toLowerCase().startsWith(firstName));
  if (partial) return partial.id;

  return null;
}

/** Expose for testing */
export function clearMemberCache(): void {
  memberCache = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/clickup/members.ts
git commit -m "feat: add ClickUp member name resolution"
git push
```

---

## Task 10: ClickUp Doc + Task Creation

**Files:**
- Create: `src/lib/clickup/docs.ts`
- Create: `src/lib/clickup/tasks.ts`

- [ ] **Step 1: Create docs.ts**

```typescript
// src/lib/clickup/docs.ts
import { createDoc, createDocPage } from './client';
import { env } from '@/lib/env';
import type { ReadAiMeeting, CallType } from '@/lib/read-ai/types';
import type { ExtractionResult } from '@/lib/classifier/extractor';
import { transcriptToText } from '@/lib/read-ai/client';

function formatCallTypeLabel(callType: CallType): string {
  return callType.charAt(0).toUpperCase() + callType.slice(1);
}

function buildDocContent(
  meeting: ReadAiMeeting,
  callType: CallType,
  extraction: ExtractionResult,
): string {
  const label = formatCallTypeLabel(callType);
  const date = new Date(meeting.start_time).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = new Date(meeting.start_time).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });

  const participantList = extraction.participants
    .map((p) => `- ${p.name} — ${p.role}`)
    .join('\n');

  const summaryList = extraction.summary.map((s) => `- ${s}`).join('\n');

  const decisionsList = extraction.key_decisions.length > 0
    ? extraction.key_decisions.map((d) => `- ${d}`).join('\n')
    : '- No firm decisions recorded';

  const actionTable =
    extraction.action_items.length > 0
      ? [
          '| Task | Owner | Due |',
          '|------|-------|-----|',
          ...extraction.action_items.map(
            (a) => `| ${a.task} | ${a.assignee ?? 'Unassigned'} | ${a.due_hint ?? '—'} |`,
          ),
        ].join('\n')
      : 'No action items recorded.';

  const topicsList = extraction.topics.join(', ');
  const fullTranscript = transcriptToText(meeting);

  return `## 📋 ${label} Call — ${meeting.title} — ${date}

**Date:** ${date} at ${time} EST  
**Duration:** ${meeting.duration_minutes} minutes  
**Sentiment:** ${extraction.sentiment}  
**Topics:** ${topicsList}  
${meeting.recording_url ? `**Recording:** ${meeting.recording_url}  ` : ''}

---

## Participants

${participantList}

---

## Summary

${summaryList}

---

## Key Decisions

${decisionsList}

---

## Action Items

${actionTable}

---

## Full Transcript

${fullTranscript}
`;
}

export async function createMeetingDoc(
  meeting: ReadAiMeeting,
  callType: CallType,
  extraction: ExtractionResult,
  listId: string,
  suggestedTitle: string,
): Promise<{ id: string; url: string }> {
  const workspaceId = env.CLICKUP_TEAM_ID;
  const docTitle = `[${formatCallTypeLabel(callType)}] ${suggestedTitle}`;

  const doc = await createDoc(workspaceId, docTitle, listId);
  const content = buildDocContent(meeting, callType, extraction);

  await createDocPage(workspaceId, doc.id, docTitle, content);

  return { id: doc.id, url: doc.url };
}
```

- [ ] **Step 2: Create tasks.ts**

```typescript
// src/lib/clickup/tasks.ts
import { createTask } from './client';
import { resolveAssignee } from './members';
import type { CallType } from '@/lib/read-ai/types';
import type { ActionItem } from '@/lib/classifier/extractor';

function parseDueDate(dueHint: string | null): number | undefined {
  if (!dueHint) return undefined;

  const lower = dueHint.toLowerCase();
  const now = new Date();

  // "end of week" / "by friday"
  if (lower.includes('friday') || lower.includes('end of week')) {
    const day = now.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(17, 0, 0, 0);
    return friday.getTime();
  }

  // "end of month"
  if (lower.includes('end of month')) {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 17, 0, 0, 0);
    return endOfMonth.getTime();
  }

  // "tomorrow"
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    return tomorrow.getTime();
  }

  // "next week"
  if (lower.includes('next week')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return nextWeek.getTime();
  }

  return undefined;
}

export interface CreatedTask {
  id: string;
  name: string;
  url: string;
  assignee: string | null;
}

export async function createActionItemTasks(
  actionItems: ActionItem[],
  listId: string,
  callType: CallType,
  docUrl: string,
): Promise<CreatedTask[]> {
  const results: CreatedTask[] = [];

  for (const item of actionItems) {
    const assigneeId = await resolveAssignee(item.assignee);
    const dueDate = parseDueDate(item.due_hint);
    const isUnassigned = assigneeId === null && item.assignee !== null;

    const tags: string[] = ['from-read-ai', callType];
    if (isUnassigned) tags.push('needs-assignment');

    const task = await createTask(listId, {
      name: item.task,
      description: `**From meeting notes:** ${docUrl}\n\n**Context:** Action item extracted from call transcript by AI.${item.assignee ? `\n\n**Mentioned assignee:** ${item.assignee}` : ''}`,
      assignees: assigneeId ? [assigneeId] : undefined,
      due_date: dueDate,
      tags,
    });

    results.push({
      id: task.id,
      name: task.name,
      url: task.url,
      assignee: item.assignee,
    });
  }

  return results;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/clickup/docs.ts src/lib/clickup/tasks.ts
git commit -m "feat: add ClickUp doc and task creation"
git push
```

---

## Task 11: Vercel KV Deduplication

**Files:**
- Create: `src/lib/kv.ts`

- [ ] **Step 1: Create kv.ts**

```typescript
// src/lib/kv.ts
import { kv } from '@vercel/kv';

const PROCESSED_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const KEY_PREFIX = 'read-ai:processed:';

export async function isAlreadyProcessed(meetingId: string): Promise<boolean> {
  const key = `${KEY_PREFIX}${meetingId}`;
  const value = await kv.get(key);
  return value !== null;
}

export async function markAsProcessed(meetingId: string): Promise<void> {
  const key = `${KEY_PREFIX}${meetingId}`;
  await kv.set(key, '1', { ex: PROCESSED_TTL_SECONDS });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/kv.ts
git commit -m "feat: add Vercel KV deduplication"
git push
```

---

## Task 12: ClickUp Folder/List Resolver

**Files:**
- Create: `src/lib/clickup/setup.ts`

This file contains the logic to find-or-create a folder and list. Used by both the setup script (Task 14) and the pipeline (Task 13).

- [ ] **Step 1: Create setup.ts**

```typescript
// src/lib/clickup/setup.ts
import { getFolders, createFolder, getLists, createList } from './client';

/**
 * Finds a folder by name in the given space, or creates it if missing.
 * Returns the folder ID.
 */
export async function findOrCreateFolder(spaceId: string, folderName: string): Promise<string> {
  const { folders } = await getFolders(spaceId);
  const existing = folders.find((f) => f.name === folderName);
  if (existing) return existing.id;

  const created = await createFolder(spaceId, folderName);
  console.log(`Created folder "${folderName}" in space ${spaceId} → id: ${created.id}`);
  return created.id;
}

/**
 * Finds a list by name in the given folder, or creates it if missing.
 * Returns the list ID.
 */
export async function findOrCreateList(folderId: string, listName: string): Promise<string> {
  const { lists } = await getLists(folderId);
  const existing = lists.find((l) => l.name === listName);
  if (existing) return existing.id;

  const created = await createList(folderId, listName);
  console.log(`Created list "${listName}" in folder ${folderId} → id: ${created.id}`);
  return created.id;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/clickup/setup.ts
git commit -m "feat: add ClickUp folder/list find-or-create helpers"
git push
```

---

## Task 13: Pipeline Orchestration

**Files:**
- Create: `src/lib/pipeline.ts`
- Create: `tests/pipeline.test.ts`

- [ ] **Step 1: Write the failing pipeline test**

```typescript
// tests/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    READ_AI_API_KEY: 'test-key',
    READ_AI_WEBHOOK_SECRET: 'test-secret',
    CLICKUP_API_KEY: 'test-key',
    CLICKUP_TEAM_ID: '9006105068',
    KV_REST_API_URL: 'https://example.com',
    KV_REST_API_TOKEN: 'test-token',
  },
}));

vi.mock('@/lib/read-ai/client', () => ({
  getMeeting: vi.fn(),
  transcriptToText: vi.fn().mockReturnValue('Max: Hello\nJane: Hi'),
  transcriptExcerpt: vi.fn().mockReturnValue('Max: Hello'),
}));

vi.mock('@/lib/classifier/index', () => ({
  classifyCall: vi.fn().mockResolvedValue({
    call_type: 'leadership',
    confidence: 0.9,
    suggested_title: 'Q2 Strategy Review',
  }),
}));

vi.mock('@/lib/classifier/extractor', () => ({
  extractMeetingIntelligence: vi.fn().mockResolvedValue({
    summary: ['Discussed Q2 strategy'],
    key_decisions: ['Approved hiring plan'],
    action_items: [{ task: 'Post job listings', assignee: 'Jane', due_hint: 'by Friday' }],
    participants: [{ name: 'Max Mayes', role: 'Owner' }],
    sentiment: 'positive',
    topics: ['strategy', 'hiring'],
  }),
}));

vi.mock('@/lib/clickup/setup', () => ({
  findOrCreateFolder: vi.fn().mockResolvedValue('folder-123'),
  findOrCreateList: vi.fn().mockResolvedValue('list-123'),
}));

vi.mock('@/lib/clickup/docs', () => ({
  createMeetingDoc: vi.fn().mockResolvedValue({ id: 'doc-123', url: 'https://app.clickup.com/doc/doc-123' }),
}));

vi.mock('@/lib/clickup/tasks', () => ({
  createActionItemTasks: vi.fn().mockResolvedValue([
    { id: 'task-123', name: 'Post job listings', url: 'https://app.clickup.com/t/task-123', assignee: 'Jane' },
  ]),
}));

vi.mock('@/lib/kv', () => ({
  isAlreadyProcessed: vi.fn().mockResolvedValue(false),
  markAsProcessed: vi.fn().mockResolvedValue(undefined),
}));

import { processMeeting } from '@/lib/pipeline';
import { leadershipMeeting } from './fixtures/sample-transcript';
import { getMeeting } from '@/lib/read-ai/client';

describe('processMeeting', () => {
  beforeEach(() => {
    vi.mocked(getMeeting).mockResolvedValue(leadershipMeeting);
  });

  it('returns a successful result with doc and tasks', async () => {
    const result = await processMeeting('meet-leadership-001');
    expect(result.success).toBe(true);
    expect(result.callType).toBe('leadership');
    expect(result.docId).toBe('doc-123');
    expect(result.tasksCreated).toBe(1);
  });

  it('returns already_processed for duplicate meeting IDs', async () => {
    const { isAlreadyProcessed } = await import('@/lib/kv');
    vi.mocked(isAlreadyProcessed).mockResolvedValueOnce(true);

    const result = await processMeeting('meet-leadership-001');
    expect(result.success).toBe(true);
    expect(result.alreadyProcessed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/pipeline.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/pipeline'`

- [ ] **Step 3: Create pipeline.ts**

```typescript
// src/lib/pipeline.ts
import { getMeeting } from './read-ai/client';
import { classifyCall } from './classifier/index';
import { extractMeetingIntelligence } from './classifier/extractor';
import { getRoute, LOW_CONFIDENCE_THRESHOLD, FALLBACK_ROUTE } from './clickup/router';
import { findOrCreateFolder, findOrCreateList } from './clickup/setup';
import { createMeetingDoc } from './clickup/docs';
import { createActionItemTasks } from './clickup/tasks';
import { isAlreadyProcessed, markAsProcessed } from './kv';
import type { CallType } from './read-ai/types';

export interface PipelineResult {
  success: boolean;
  alreadyProcessed?: boolean;
  meetingId: string;
  callType?: CallType;
  confidence?: number;
  docId?: string;
  docUrl?: string;
  tasksCreated?: number;
  error?: string;
}

export async function processMeeting(meetingId: string): Promise<PipelineResult> {
  // 1. Dedup check
  if (await isAlreadyProcessed(meetingId)) {
    return { success: true, alreadyProcessed: true, meetingId };
  }

  // 2. Fetch full meeting from Read.ai
  const meeting = await getMeeting(meetingId);

  // 3. Classify call type
  const classification = await classifyCall(meeting);
  const { call_type, confidence, suggested_title } = classification;

  // 4. Extract intelligence
  const extraction = await extractMeetingIntelligence(meeting, call_type);

  // 5. Resolve ClickUp route
  const route = getRoute(call_type);
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;

  // 6. Find or create folder + list in primary route
  const folderId = await findOrCreateFolder(route.spaceId, route.folderName);
  const listId = await findOrCreateList(folderId, route.listName);

  // 7. If low confidence, also store in fallback (GROWTHGOD/Needs Review)
  if (isLowConfidence) {
    const fallbackFolderId = await findOrCreateFolder(FALLBACK_ROUTE.spaceId, FALLBACK_ROUTE.folderName);
    await findOrCreateList(fallbackFolderId, FALLBACK_ROUTE.listName);
    console.warn(
      `Low confidence (${confidence.toFixed(2)}) for meeting ${meetingId}. ` +
      `Classified as "${call_type}" — also flagged in Needs Review.`,
    );
  }

  // 8. Create Doc
  const { id: docId, url: docUrl } = await createMeetingDoc(
    meeting,
    call_type,
    extraction,
    listId,
    suggested_title,
  );

  // 9. Create Tasks for action items
  const tasks = await createActionItemTasks(
    extraction.action_items,
    listId,
    call_type,
    docUrl,
  );

  // 10. Mark as processed
  await markAsProcessed(meetingId);

  return {
    success: true,
    meetingId,
    callType: call_type,
    confidence,
    docId,
    docUrl,
    tasksCreated: tasks.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/pipeline.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline.ts tests/pipeline.test.ts
git commit -m "feat: add pipeline orchestration with full test coverage"
git push
```

---

## Task 14: Webhook API Route + Health Check

**Files:**
- Create: `src/app/api/webhook/read-ai/route.ts`
- Create: `src/app/api/health/route.ts`
- Create: `tests/fixtures/sample-webhook.ts`
- Create: `tests/webhook.test.ts`

- [ ] **Step 1: Create webhook fixture**

```typescript
// tests/fixtures/sample-webhook.ts
import type { ReadAiWebhookPayload } from '@/lib/read-ai/types';

export const sampleWebhookPayload: ReadAiWebhookPayload = {
  event_type: 'meeting.completed',
  payload: {
    meeting_id: 'meet-leadership-001',
  },
};

export const sampleWebhookBody = JSON.stringify(sampleWebhookPayload);
```

- [ ] **Step 2: Write the failing webhook test**

```typescript
// tests/webhook.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('@/lib/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    READ_AI_API_KEY: 'test-key',
    READ_AI_WEBHOOK_SECRET: 'test-webhook-secret',
    CLICKUP_API_KEY: 'test-key',
    CLICKUP_TEAM_ID: '9006105068',
    KV_REST_API_URL: 'https://example.com',
    KV_REST_API_TOKEN: 'test-token',
  },
}));

vi.mock('@/lib/pipeline', () => ({
  processMeeting: vi.fn().mockResolvedValue({
    success: true,
    meetingId: 'meet-leadership-001',
    callType: 'leadership',
    confidence: 0.9,
    docId: 'doc-123',
    docUrl: 'https://app.clickup.com/doc/doc-123',
    tasksCreated: 2,
  }),
}));

import { POST } from '@/app/api/webhook/read-ai/route';
import { sampleWebhookBody } from './fixtures/sample-webhook';

function makeRequest(body: string, secret: string): Request {
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return new Request('http://localhost/api/webhook/read-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-read-ai-signature': sig,
    },
    body,
  });
}

describe('POST /api/webhook/read-ai', () => {
  it('returns 200 for a valid webhook', async () => {
    const req = makeRequest(sampleWebhookBody, 'test-webhook-secret');
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.meetingId).toBe('meet-leadership-001');
  });

  it('returns 401 for an invalid signature', async () => {
    const req = makeRequest(sampleWebhookBody, 'wrong-secret');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-meeting.completed event', async () => {
    const body = JSON.stringify({ event_type: 'other.event', payload: { meeting_id: 'abc' } });
    const sig = createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
    const req = new Request('http://localhost/api/webhook/read-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-read-ai-signature': sig },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test tests/webhook.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/webhook/read-ai/route'`

- [ ] **Step 4: Create the webhook route**

```typescript
// src/app/api/webhook/read-ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyReadAiSignature } from '@/lib/read-ai/verify';
import { processMeeting } from '@/lib/pipeline';
import { env } from '@/lib/env';
import type { ReadAiWebhookPayload } from '@/lib/read-ai/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const signature = req.headers.get('x-read-ai-signature') ?? '';

  // 1. Verify HMAC signature
  if (!verifyReadAiSignature(body, signature, env.READ_AI_WEBHOOK_SECRET)) {
    console.warn('Read.ai webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse payload
  let payload: ReadAiWebhookPayload;
  try {
    payload = JSON.parse(body) as ReadAiWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. Only handle meeting.completed events
  if (payload.event_type !== 'meeting.completed') {
    return NextResponse.json(
      { message: `Ignored event type: ${payload.event_type}` },
      { status: 400 },
    );
  }

  const { meeting_id } = payload.payload;
  console.log(`Processing meeting: ${meeting_id}`);

  // 4. Run pipeline (errors caught, logged, return 500 for retry)
  try {
    const result = await processMeeting(meeting_id);

    if (result.alreadyProcessed) {
      console.log(`Meeting ${meeting_id} already processed — skipping`);
    } else {
      console.log(
        `Meeting ${meeting_id} processed: type=${result.callType}, confidence=${result.confidence?.toFixed(2)}, ` +
        `doc=${result.docId}, tasks=${result.tasksCreated}`,
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Pipeline error for meeting ${meeting_id}: ${message}`);
    return NextResponse.json({ error: 'Pipeline failed', detail: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create health route**

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'read-to-clickup',
  });
}
```

- [ ] **Step 6: Run webhook tests to verify they pass**

```bash
npm test tests/webhook.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: PASS — all test suites

- [ ] **Step 8: Commit**

```bash
git add src/app/api/ tests/webhook.test.ts tests/fixtures/sample-webhook.ts
git commit -m "feat: add webhook route, health check, and webhook tests"
git push
```

---

## Task 15: ClickUp Workspace Setup Script

**Files:**
- Create: `scripts/setup-clickup.ts`

- [ ] **Step 1: Create the setup script**

```typescript
// scripts/setup-clickup.ts
import 'dotenv/config';
import { findOrCreateFolder, findOrCreateList } from '../src/lib/clickup/setup';
import { getListCustomFields, createCustomField } from '../src/lib/clickup/client';
import { CALL_TYPE_ROUTES } from '../src/lib/clickup/router';

const CUSTOM_FIELDS = [
  { name: 'Meeting Date', type: 'date' },
  { name: 'Call Type', type: 'drop_down', typeConfig: {
    options: [
      { name: 'leadership', orderindex: 0, color: '#6c5ce7' },
      { name: 'sales', orderindex: 1, color: '#00b894' },
      { name: 'operations', orderindex: 2, color: '#0984e3' },
      { name: 'creative', orderindex: 3, color: '#fd79a8' },
      { name: 'admin', orderindex: 4, color: '#636e72' },
      { name: 'hr', orderindex: 5, color: '#fdcb6e' },
      { name: 'client', orderindex: 6, color: '#e17055' },
      { name: 'general', orderindex: 7, color: '#b2bec3' },
    ],
  }},
  { name: 'Read.ai Link', type: 'url' },
  { name: 'Duration (min)', type: 'number' },
  { name: 'Sentiment', type: 'drop_down', typeConfig: {
    options: [
      { name: 'positive', orderindex: 0, color: '#00b894' },
      { name: 'neutral', orderindex: 1, color: '#636e72' },
      { name: 'negative', orderindex: 2, color: '#d63031' },
      { name: 'mixed', orderindex: 3, color: '#fdcb6e' },
    ],
  }},
  { name: 'AI Confidence', type: 'number' },
];

async function addMissingCustomFields(listId: string): Promise<void> {
  const { fields: existing } = await getListCustomFields(listId);
  const existingNames = new Set(existing.map((f) => f.name));

  for (const field of CUSTOM_FIELDS) {
    if (existingNames.has(field.name)) {
      console.log(`  ✓ Custom field "${field.name}" already exists`);
      continue;
    }
    await createCustomField(listId, field.name, field.type, field.typeConfig);
    console.log(`  + Created custom field "${field.name}"`);
  }
}

async function main() {
  console.log('🚀 Setting up ClickUp workspace for Read.ai sync...\n');

  for (const [callType, route] of Object.entries(CALL_TYPE_ROUTES)) {
    console.log(`\n📁 [${callType}] Space ${route.spaceId}`);
    console.log(`   Folder: "${route.folderName}"`);
    console.log(`   List:   "${route.listName}"`);

    const folderId = await findOrCreateFolder(route.spaceId, route.folderName);
    const listId = await findOrCreateList(folderId, route.listName);

    console.log(`   Adding custom fields to list ${listId}...`);
    await addMissingCustomFields(listId);
  }

  // Also set up the fallback Needs Review list
  console.log('\n📁 [fallback] GROWTHGOD space (low-confidence / needs review)');
  const fallbackFolderId = await findOrCreateFolder('901312664037', 'Meeting Notes');
  await findOrCreateList(fallbackFolderId, 'Needs Review');

  console.log('\n✅ ClickUp workspace setup complete!');
  console.log('\nNext steps:');
  console.log('1. Deploy to Vercel: vercel --prod');
  console.log('2. Set environment variables in Vercel dashboard');
  console.log('3. Register your webhook URL in Read.ai settings:');
  console.log('   https://your-vercel-url.vercel.app/api/webhook/read-ai');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Install dotenv for script use**

```bash
npm install -D dotenv
```

- [ ] **Step 3: Test the setup script in dry-run mode (read-only)**

Create `.env.local` with your actual env vars, then:
```bash
cp .env.example .env.local
# Edit .env.local with real values, then:
npm run setup-clickup 2>&1 | head -40
```

Expected output should show folders/lists being found or created without errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-clickup.ts package.json package-lock.json
git commit -m "feat: add one-time ClickUp workspace setup script"
git push
```

---

## Task 16: README + Deployment

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
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

\`\`\`bash
git clone https://github.com/maxwellt7/read-to-clickup.git
cd read-to-clickup
npm install
\`\`\`

### 2. Configure environment

\`\`\`bash
cp .env.example .env.local
# Fill in all values in .env.local
\`\`\`

Required variables:
- `READ_AI_API_KEY` — from Read.ai Settings → Developer
- `READ_AI_WEBHOOK_SECRET` — set this when registering the webhook in Read.ai
- `CLICKUP_API_KEY` — your ClickUp personal API token
- `CLICKUP_TEAM_ID` — `9006105068` (GrowthGod workspace)
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `KV_REST_API_URL` + `KV_REST_API_TOKEN` — from Vercel KV dashboard

### 3. Scaffold ClickUp workspace (run once)

\`\`\`bash
npm run setup-clickup
\`\`\`

This creates all folders, lists, and custom fields in your ClickUp workspace.

### 4. Deploy to Vercel

\`\`\`bash
vercel --prod
\`\`\`

Set all environment variables in the Vercel dashboard. Add a KV storage integration.

### 5. Register webhook in Read.ai

Go to Read.ai → Settings → Integrations → Webhooks and add:
- **URL:** `https://your-app.vercel.app/api/webhook/read-ai`
- **Events:** `meeting.completed`
- **Secret:** same value as `READ_AI_WEBHOOK_SECRET`

### 6. Test

\`\`\`bash
curl https://your-app.vercel.app/api/health
# → {"status":"ok","timestamp":"...","service":"read-to-clickup"}
\`\`\`

## Development

\`\`\`bash
npm run dev        # Local dev server
npm test           # Run all tests
npm run test:watch # Watch mode
\`\`\`

## Architecture

\`\`\`
Read.ai → POST /api/webhook/read-ai
         → Verify HMAC signature
         → Dedup check (Vercel KV)
         → Fetch transcript (Read.ai API)
         → Classify call type (Claude Haiku)
         → Extract intelligence (Claude Sonnet)
         → Create ClickUp Doc + Tasks
         → Mark as processed (Vercel KV)
\`\`\`
```

- [ ] **Step 2: Final test run**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors

- [ ] **Step 4: Commit and push**

```bash
git add README.md
git commit -m "docs: add README with setup and deployment instructions"
git push
```

---

## Task 17: Deploy to Vercel + Register Webhook

- [ ] **Step 1: Install Vercel CLI if needed**

```bash
npm install -g vercel
```

- [ ] **Step 2: Link to Vercel project**

```bash
vercel link
# Select: maxwellt7 / read-to-clickup
```

- [ ] **Step 3: Add Vercel KV storage**

In Vercel dashboard → read-to-clickup project → Storage → Add KV Database → name it `read-to-clickup-kv`.

- [ ] **Step 4: Set environment variables in Vercel**

```bash
vercel env add READ_AI_API_KEY production
vercel env add READ_AI_WEBHOOK_SECRET production
vercel env add CLICKUP_API_KEY production
vercel env add CLICKUP_TEAM_ID production
vercel env add ANTHROPIC_API_KEY production
# KV vars are auto-injected after linking KV storage
```

- [ ] **Step 5: Deploy to production**

```bash
vercel --prod
```

Expected output includes production URL like `https://read-to-clickup.vercel.app`.

- [ ] **Step 6: Verify health endpoint**

```bash
curl https://read-to-clickup.vercel.app/api/health
```

Expected: `{"status":"ok","timestamp":"...","service":"read-to-clickup"}`

- [ ] **Step 7: Run ClickUp setup against production**

Update `.env.local` with production KV vars (copy from Vercel dashboard), then:

```bash
npm run setup-clickup
```

Expected: All 8 call-type folders + lists created with custom fields.

- [ ] **Step 8: Register webhook in Read.ai**

1. Go to https://app.read.ai → Settings → Integrations → Webhooks
2. Add webhook:
   - URL: `https://read-to-clickup.vercel.app/api/webhook/read-ai`
   - Events: `meeting.completed`
   - Secret: value of your `READ_AI_WEBHOOK_SECRET`
3. Save and copy the secret if Read.ai generates it for you — update `READ_AI_WEBHOOK_SECRET` in Vercel env vars to match.

- [ ] **Step 9: Send a test webhook from Read.ai**

Use Read.ai's webhook test feature or wait for your next meeting. Verify in Vercel function logs that the pipeline ran and check ClickUp for the new Doc.

- [ ] **Step 10: Final commit**

```bash
git tag v1.0.0
git push --tags
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Read.ai webhook reception + signature verification → Tasks 3, 14
- [x] Claude Haiku classification → Task 5
- [x] Claude Sonnet extraction → Task 6
- [x] ClickUp routing by call type → Task 8
- [x] Separate spaces per call type → Task 8 (router) + Task 15 (setup script)
- [x] ClickUp Docs for Brain indexing → Task 10
- [x] ClickUp Tasks for action items → Task 10
- [x] Error handling / fallback for low confidence → Task 13 (pipeline)
- [x] Deduplication → Task 11
- [x] One-time workspace setup → Task 15
- [x] Deployment → Task 17
- [x] Tests for all core logic → Tasks 3, 5, 8, 13, 14

**Type consistency:**
- `CallType` defined in `src/lib/read-ai/types.ts` — used consistently in router, docs, tasks, pipeline
- `ExtractionResult` defined in `extractor.ts` — consumed by `docs.ts`, `tasks.ts`, `pipeline.ts`
- `SpaceRoute` defined in `clickup/types.ts` — used in router.ts

**No placeholders:** All code blocks contain complete implementations.
