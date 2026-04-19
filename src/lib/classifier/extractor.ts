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

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function extractMeetingIntelligence(
  meeting: ReadAiMeeting,
  callType: string,
): Promise<ExtractionResult> {
  const fullTranscript = transcriptToText(meeting);
  const prompt = buildExtractionPrompt(meeting, callType, fullTranscript);

  const message = await anthropic.messages.create({
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

  const rawItems = Array.isArray(result.action_items) ? result.action_items : [];
  const action_items: ActionItem[] = rawItems.filter(
    (i): i is ActionItem => typeof i?.task === 'string' && i.task.length > 0,
  );

  return {
    summary: result.summary ?? [],
    key_decisions: result.key_decisions ?? [],
    action_items,
    participants: result.participants ?? meeting.participants.map((p) => ({
      name: p.name,
      role: 'Participant',
    })),
    sentiment: result.sentiment ?? 'neutral',
    topics: result.topics ?? [],
  };
}
