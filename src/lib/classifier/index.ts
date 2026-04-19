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

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function classifyCall(
  meeting: ReadAiMeeting,
): Promise<ClassificationResult> {
  const prompt = buildClassificationPrompt(meeting);

  const message = await anthropic.messages.create({
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
