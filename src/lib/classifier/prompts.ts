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
  "sentiment": "positive",
  "topics": ["topic 1", "topic 2", "topic 3"]
}

Rules:
- summary: 3-5 bullet points capturing the most important points
- key_decisions: only firm decisions made, not discussions
- action_items: only concrete tasks with a clear owner or action, not vague todos
- assignee: use the exact name as spoken in the meeting, or null if unclear
- due_hint: exact phrase from transcript ("by Friday", "end of month"), or null
- sentiment: one of "positive", "neutral", "negative", "mixed"
- topics: 3-5 high-level topics discussed`;
}
