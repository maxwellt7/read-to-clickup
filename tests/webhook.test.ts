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

const mockProcessMeeting = vi.hoisted(() => vi.fn());
vi.mock('@/lib/pipeline', () => ({
  processMeeting: mockProcessMeeting,
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
    mockProcessMeeting.mockResolvedValueOnce({
      success: true,
      meetingId: 'meet-leadership-001',
      callType: 'leadership',
      confidence: 0.9,
      docId: 'doc-123',
      docUrl: 'https://app.clickup.com/doc/doc-123',
      tasksCreated: 2,
    });
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

  it('returns 400 for a non meeting.completed event', async () => {
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
