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
