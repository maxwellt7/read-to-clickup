// src/lib/clickup/docs.ts
import { createDoc, createDocPage } from './client';
import { env } from '@/lib/env';
import type { ReadAiMeeting, CallType } from '@/lib/read-ai/types';
import type { ExtractionResult } from '@/lib/classifier/extractor';
import { transcriptToText } from '@/lib/read-ai/client';

function formatCallTypeLabel(callType: CallType): string {
  return callType.charAt(0).toUpperCase() + callType.slice(1);
}

function buildDocContent(
  meeting: ReadAiMeeting,
  callType: CallType,
  extraction: ExtractionResult,
): string {
  const label = formatCallTypeLabel(callType);
  const date = new Date(meeting.start_time).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = new Date(meeting.start_time).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });

  const participantList = extraction.participants
    .map((p) => `- ${p.name} — ${p.role}`)
    .join('\n');

  const summaryList = extraction.summary.map((s) => `- ${s}`).join('\n');

  const decisionsList = extraction.key_decisions.length > 0
    ? extraction.key_decisions.map((d) => `- ${d}`).join('\n')
    : '- No firm decisions recorded';

  const actionTable =
    extraction.action_items.length > 0
      ? [
          '| Task | Owner | Due |',
          '|------|-------|-----|',
          ...extraction.action_items.map(
            (a) => `| ${a.task.replace(/\|/g, '\\|')} | ${(a.assignee ?? 'Unassigned').replace(/\|/g, '\\|')} | ${(a.due_hint ?? '—').replace(/\|/g, '\\|')} |`,
          ),
        ].join('\n')
      : 'No action items recorded.';

  const topicsList = extraction.topics.join(', ') || 'None identified';
  const fullTranscript = transcriptToText(meeting);

  return `## 📋 ${label} Call — ${meeting.title} — ${date}

**Date:** ${date} at ${time} EST
**Duration:** ${meeting.duration_minutes} minutes
**Sentiment:** ${extraction.sentiment}
**Topics:** ${topicsList}
${meeting.recording_url ? `**Recording:** ${meeting.recording_url}` : ''}

---

## Participants

${participantList}

---

## Summary

${summaryList}

---

## Key Decisions

${decisionsList}

---

## Action Items

${actionTable}

---

## Full Transcript

${fullTranscript}
`;
}

export async function createMeetingDoc(
  meeting: ReadAiMeeting,
  callType: CallType,
  extraction: ExtractionResult,
  listId: string,
  suggestedTitle: string,
): Promise<{ id: string; url: string }> {
  const workspaceId = env.CLICKUP_TEAM_ID;
  const docTitle = `[${formatCallTypeLabel(callType)}] ${suggestedTitle}`;

  const doc = await createDoc(workspaceId, docTitle, listId);
  const content = buildDocContent(meeting, callType, extraction);

  await createDocPage(workspaceId, doc.id, docTitle, content);

  return { id: doc.id, url: doc.url };
}
