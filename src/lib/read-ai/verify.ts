import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies the Read.ai webhook HMAC-SHA256 signature.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyReadAiSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
