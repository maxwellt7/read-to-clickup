import { describe, it, expect, vi } from 'vitest';

const mockCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          call_type: 'leadership',
          confidence: 0.92,
          suggested_title: 'Q2 Strategy Review',
        }),
      },
    ],
  }),
);

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

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

import { classifyCall } from '@/lib/classifier/index';
import { leadershipMeeting } from './fixtures/sample-transcript';
import type { CallType } from '@/lib/read-ai/types';

const VALID_CALL_TYPES: CallType[] = [
  'leadership', 'sales', 'operations', 'creative',
  'admin', 'hr', 'client', 'general',
];

describe('classifyCall', () => {
  it('returns a valid call_type and confidence', async () => {
    const result = await classifyCall(leadershipMeeting);
    expect(VALID_CALL_TYPES).toContain(result.call_type);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.suggested_title).toBe('string');
  });

  it('defaults to "general" for an unknown call type from Claude', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ call_type: 'unknown_type', confidence: 0.5, suggested_title: 'Test' }) }],
    });
    const result = await classifyCall(leadershipMeeting);
    expect(result.call_type).toBe('general');
  });
});
