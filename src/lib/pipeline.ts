// src/lib/pipeline.ts
import { getMeeting } from './read-ai/client';
import { classifyCall } from './classifier/index';
import { extractMeetingIntelligence } from './classifier/extractor';
import { getRoute, LOW_CONFIDENCE_THRESHOLD, FALLBACK_ROUTE } from './clickup/router';
import { findOrCreateFolder, findOrCreateList } from './clickup/setup';
import { createMeetingDoc } from './clickup/docs';
import { createActionItemTasks } from './clickup/tasks';
import { isAlreadyProcessed, markAsProcessed } from './kv';
import type { CallType } from './read-ai/types';

export interface PipelineResult {
  success: boolean;
  alreadyProcessed?: boolean;
  meetingId: string;
  callType?: CallType;
  confidence?: number;
  docId?: string;
  docUrl?: string;
  tasksCreated?: number;
  error?: string;
}

export async function processMeeting(meetingId: string): Promise<PipelineResult> {
  // 1. Dedup check
  if (await isAlreadyProcessed(meetingId)) {
    return { success: true, alreadyProcessed: true, meetingId };
  }

  // 2. Fetch full meeting from Read.ai
  const meeting = await getMeeting(meetingId);

  // 3. Classify call type
  const { call_type, confidence, suggested_title } = await classifyCall(meeting);

  // 4. Extract intelligence
  const extraction = await extractMeetingIntelligence(meeting, call_type);

  // 5. Resolve ClickUp route
  const route = getRoute(call_type);
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;

  // 6. Find or create folder + list in primary route
  const folderId = await findOrCreateFolder(route.spaceId, route.folderName);
  const listId = await findOrCreateList(folderId, route.listName);

  // 7. If low confidence, also ensure fallback list exists
  if (isLowConfidence) {
    const fallbackFolderId = await findOrCreateFolder(FALLBACK_ROUTE.spaceId, FALLBACK_ROUTE.folderName);
    await findOrCreateList(fallbackFolderId, FALLBACK_ROUTE.listName);
    console.warn(
      `Low confidence (${confidence.toFixed(2)}) for meeting ${meetingId}. ` +
      `Classified as "${call_type}" — also flagged in Needs Review.`,
    );
  }

  // 8. Create Doc
  const { id: docId, url: docUrl } = await createMeetingDoc(
    meeting,
    call_type,
    extraction,
    listId,
    suggested_title,
  );

  // 9. Create Tasks for action items
  const tasks = await createActionItemTasks(
    extraction.action_items,
    listId,
    call_type,
    docUrl,
  );

  // 10. Mark as processed
  await markAsProcessed(meetingId);

  return {
    success: true,
    meetingId,
    callType: call_type,
    confidence,
    docId,
    docUrl,
    tasksCreated: tasks.length,
  };
}
