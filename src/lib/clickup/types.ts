// src/lib/clickup/types.ts

export interface ClickUpMember {
  id: number;
  username: string;
  email: string;
  initials: string;
}

export interface ClickUpFolder {
  id: string;
  name: string;
}

export interface ClickUpList {
  id: string;
  name: string;
  folder: { id: string; name: string };
  space: { id: string; name: string };
}

export interface ClickUpTask {
  id: string;
  name: string;
  url: string;
}

export interface ClickUpDoc {
  id: string;
  name: string;
  url: string;
}

export interface CreateTaskPayload {
  name: string;
  description: string;
  assignees?: number[];
  due_date?: number;
  tags?: string[];
  custom_fields?: { id: string; value: string | number }[];
}

export interface SpaceRoute {
  spaceId: string;
  folderName: string;
  listName: string;
}
