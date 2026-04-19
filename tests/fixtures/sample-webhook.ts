import type { ReadAiWebhookPayload } from '@/lib/read-ai/types';

export const sampleWebhookPayload: ReadAiWebhookPayload = {
  event_type: 'meeting.completed',
  payload: {
    meeting_id: 'meet-leadership-001',
  },
};

export const sampleWebhookBody = JSON.stringify(sampleWebhookPayload);
