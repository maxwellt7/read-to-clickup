// tests/extractor.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

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

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

import { extractMeetingIntelligence } from '@/lib/classifier/extractor';
import { leadershipMeeting } from './fixtures/sample-transcript';

const mockExtractionResponse = {
  summary: ['Point 1', 'Point 2'],
  key_decisions: ['Decision 1'],
  action_items: [{ task: 'Post job listings', assignee: 'Jane', due_hint: 'by Friday' }],
  participants: [{ name: 'Max Mayes', role: 'Owner' }],
  sentiment: 'positive',
  topics: ['strategy', 'hiring'],
};

describe('extractMeetingIntelligence', () => {
  it('returns structured extraction result', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(mockExtractionResponse) }],
    });
    const result = await extractMeetingIntelligence(leadershipMeeting, 'leadership');
    expect(result.summary).toHaveLength(2);
    expect(result.action_items[0].task).toBe('Post job listings');
    expect(result.action_items[0].assignee).toBe('Jane');
    expect(result.sentiment).toBe('positive');
  });

  it('filters out action items with missing task field', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...mockExtractionResponse,
          action_items: [
            { task: 'Valid task', assignee: null, due_hint: null },
            { assignee: 'Someone', due_hint: null }, // missing task
            { task: '', assignee: null, due_hint: null }, // empty task
          ],
        }),
      }],
    });
    const result = await extractMeetingIntelligence(leadershipMeeting, 'leadership');
    expect(result.action_items).toHaveLength(1);
    expect(result.action_items[0].task).toBe('Valid task');
  });

  it('uses safe defaults when Claude returns partial data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ summary: ['Only this'] }) }],
    });
    const result = await extractMeetingIntelligence(leadershipMeeting, 'leadership');
    expect(result.key_decisions).toEqual([]);
    expect(result.action_items).toEqual([]);
    expect(result.sentiment).toBe('neutral');
    expect(result.topics).toEqual([]);
  });
});
