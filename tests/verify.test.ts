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

  it('returns false for a null signature', () => {
    expect(verifyReadAiSignature(BODY, null, SECRET)).toBe(false);
  });
});
