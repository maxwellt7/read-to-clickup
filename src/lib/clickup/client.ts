// src/lib/clickup/client.ts
import { env } from '@/lib/env';

const BASE_URL = 'https://api.clickup.com/api/v2';
const BASE_URL_V3 = 'https://api.clickup.com/api/v3';

function authHeaders() {
  return {
    Authorization: env.CLICKUP_API_KEY,
    'Content-Type': 'application/json',
  };
}

async function clickupFetch<T>(
  path: string,
  options: RequestInit = {},
  version: 'v2' | 'v3' = 'v2',
): Promise<T> {
  const base = version === 'v3' ? BASE_URL_V3 : BASE_URL;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Folders ─────────────────────────────────────────────────────────────────

export async function getFolders(
  spaceId: string,
): Promise<{ folders: { id: string; name: string }[] }> {
  return clickupFetch(`/space/${spaceId}/folder?archived=false`);
}

export async function createFolder(
  spaceId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return clickupFetch(`/space/${spaceId}/folder`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// ── Lists ────────────────────────────────────────────────────────────────────

export async function getLists(
  folderId: string,
): Promise<{ lists: { id: string; name: string }[] }> {
  return clickupFetch(`/folder/${folderId}/list?archived=false`);
}

export async function createList(
  folderId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return clickupFetch(`/folder/${folderId}/list`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(
  listId: string,
  payload: import('./types').CreateTaskPayload,
): Promise<{ id: string; name: string; url: string }> {
  return clickupFetch(`/list/${listId}/task`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Members ──────────────────────────────────────────────────────────────────

export async function getTeamMembers(
  teamId: string,
): Promise<{ team: { members: { user: import('./types').ClickUpMember }[] } }> {
  return clickupFetch(`/team/${teamId}`);
}

// ── Docs (v3) ────────────────────────────────────────────────────────────────

export async function createDoc(
  workspaceId: string,
  name: string,
  listId: string,
): Promise<{ id: string; name: string; url: string }> {
  return clickupFetch(
    `/workspaces/${workspaceId}/docs`,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        parent: { type: 7, id: listId },
        visibility: 'PRIVATE',
        create_page: true,
      }),
    },
    'v3',
  );
}

export async function createDocPage(
  workspaceId: string,
  docId: string,
  name: string,
  content: string,
): Promise<{ id: string }> {
  return clickupFetch(
    `/workspaces/${workspaceId}/docs/${docId}/pages`,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        content,
        content_format: 'text/md',
      }),
    },
    'v3',
  );
}

// ── Custom Fields ────────────────────────────────────────────────────────────

export async function getListCustomFields(
  listId: string,
): Promise<{ fields: { id: string; name: string; type: string }[] }> {
  return clickupFetch(`/list/${listId}/field`);
}

export async function createCustomField(
  listId: string,
  name: string,
  type: string,
  typeConfig?: Record<string, unknown>,
): Promise<{ id: string; name: string }> {
  return clickupFetch(`/list/${listId}/field`, {
    method: 'POST',
    body: JSON.stringify({ name, type, type_config: typeConfig ?? {} }),
  });
}
