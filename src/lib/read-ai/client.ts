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
