// src/lib/clickup/tasks.ts
import { createTask } from './client';
import { resolveAssignee } from './members';
import type { CallType } from '@/lib/read-ai/types';
import type { ActionItem } from '@/lib/classifier/extractor';

function parseDueDate(dueHint: string | null): number | undefined {
  if (!dueHint) return undefined;

  const lower = dueHint.toLowerCase();
  const now = new Date();

  if (lower.includes('friday') || lower.includes('end of week')) {
    const day = now.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(17, 0, 0, 0);
    return friday.getTime();
  }

  if (lower.includes('end of month')) {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 17, 0, 0, 0);
    return endOfMonth.getTime();
  }

  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    return tomorrow.getTime();
  }

  if (lower.includes('next week')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    nextWeek.setHours(17, 0, 0, 0);
    return nextWeek.getTime();
  }

  return undefined;
}

export interface CreatedTask {
  id: string;
  name: string;
  url: string;
  assignee: string | null;
}

export async function createActionItemTasks(
  actionItems: ActionItem[],
  listId: string,
  callType: CallType,
  docUrl: string,
): Promise<CreatedTask[]> {
  const results: CreatedTask[] = [];

  for (const item of actionItems) {
    const assigneeId = await resolveAssignee(item.assignee);
    const dueDate = parseDueDate(item.due_hint);
    const isUnassigned = assigneeId === null && item.assignee !== null;

    const tags: string[] = ['from-read-ai', callType];
    if (isUnassigned) tags.push('needs-assignment');

    const task = await createTask(listId, {
      name: item.task,
      description: `**From meeting notes:** ${docUrl}\n\n**Context:** Action item extracted from call transcript by AI.${item.assignee ? `\n\n**Mentioned assignee:** ${item.assignee}` : ''}`,
      assignees: assigneeId ? [assigneeId] : undefined,
      due_date: dueDate,
      tags,
    });

    results.push({
      id: task.id,
      name: task.name,
      url: task.url,
      assignee: item.assignee,
    });
  }

  return results;
}
