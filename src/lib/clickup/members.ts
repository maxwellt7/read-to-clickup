// src/lib/clickup/members.ts
import { getTeamMembers } from './client';
import { env } from '@/lib/env';
import type { ClickUpMember } from './types';

let memberCache: ClickUpMember[] | null = null;

export async function getMembers(): Promise<ClickUpMember[]> {
  if (memberCache) return memberCache;
  const data = await getTeamMembers(env.CLICKUP_TEAM_ID);
  memberCache = data.team.members.map((m) => m.user);
  return memberCache;
}

/**
 * Fuzzy-match a name from the transcript to a ClickUp user ID.
 * Returns null if no match found.
 */
export async function resolveAssignee(name: string | null): Promise<number | null> {
  if (!name) return null;

  const members = await getMembers();
  const normalizedName = name.toLowerCase().trim();

  // Exact match
  const exact = members.find((m) => m.username.toLowerCase() === normalizedName);
  if (exact) return exact.id;

  // First name match
  const firstName = normalizedName.split(' ')[0];
  const partial = members.find((m) => m.username.toLowerCase().startsWith(firstName));
  if (partial) return partial.id;

  return null;
}

/** Expose for testing */
export function clearMemberCache(): void {
  memberCache = null;
}
