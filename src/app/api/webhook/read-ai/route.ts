import { NextRequest, NextResponse } from 'next/server';
import { verifyReadAiSignature } from '@/lib/read-ai/verify';
import { processMeeting } from '@/lib/pipeline';
import { env } from '@/lib/env';
import type { ReadAiWebhookPayload } from '@/lib/read-ai/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const signature = req.headers.get('x-read-ai-signature');

  // 1. Verify HMAC signature
  if (!verifyReadAiSignature(body, signature, env.READ_AI_WEBHOOK_SECRET)) {
    console.warn('Read.ai webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse payload
  let payload: ReadAiWebhookPayload;
  try {
    payload = JSON.parse(body) as ReadAiWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. Only handle meeting.completed events
  if (payload.event_type !== 'meeting.completed') {
    return NextResponse.json(
      { message: `Ignored event type: ${payload.event_type}` },
      { status: 400 },
    );
  }

  const { meeting_id } = payload.payload;
  console.log(`Processing meeting: ${meeting_id}`);

  // 4. Run pipeline
  const result = await processMeeting(meeting_id);

  if (result.alreadyProcessed) {
    console.log(`Meeting ${meeting_id} already processed — skipping`);
  } else if (result.success) {
    console.log(
      `Meeting ${meeting_id} processed: type=${result.callType}, confidence=${result.confidence?.toFixed(2)}, ` +
      `doc=${result.docId}, tasks=${result.tasksCreated}`,
    );
  } else {
    console.error(`Pipeline failed for meeting ${meeting_id}: ${result.error}`);
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}
