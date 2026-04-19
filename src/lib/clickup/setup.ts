// src/lib/clickup/setup.ts
import { getFolders, createFolder, getLists, createList } from './client';

/**
 * Finds a folder by name in the given space, or creates it if missing.
 * Returns the folder ID.
 */
export async function findOrCreateFolder(spaceId: string, folderName: string): Promise<string> {
  const { folders } = await getFolders(spaceId);
  const existing = folders.find((f) => f.name === folderName);
  if (existing) return existing.id;

  const created = await createFolder(spaceId, folderName);
  console.log(`Created folder "${folderName}" in space ${spaceId} → id: ${created.id}`);
  return created.id;
}

/**
 * Finds a list by name in the given folder, or creates it if missing.
 * Returns the list ID.
 */
export async function findOrCreateList(folderId: string, listName: string): Promise<string> {
  const { lists } = await getLists(folderId);
  const existing = lists.find((l) => l.name === listName);
  if (existing) return existing.id;

  const created = await createList(folderId, listName);
  console.log(`Created list "${listName}" in folder ${folderId} → id: ${created.id}`);
  return created.id;
}
