// src/lib/clickup/router.ts
import type { CallType } from '@/lib/read-ai/types';
import type { SpaceRoute } from './types';

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// GrowthGod workspace (id: 9006105068) space IDs
export const CALL_TYPE_ROUTES: Record<CallType, SpaceRoute> = {
  leadership: {
    spaceId: '901312664119',   // LEADERSHIP space
    folderName: 'Meeting Notes',
    listName: 'Leadership Calls',
  },
  sales: {
    spaceId: '901312939631',   // Acquisition Systems space
    folderName: 'Call Notes',
    listName: 'Sales Calls',
  },
  operations: {
    spaceId: '90131759723',    // Operations space
    folderName: 'Meeting Notes',
    listName: 'Ops Calls',
  },
  creative: {
    spaceId: '901311249959',   // Creative space
    folderName: 'Meeting Notes',
    listName: 'Creative Calls',
  },
  admin: {
    spaceId: '901312664105',   // ADMIN space
    folderName: 'Meeting Notes',
    listName: 'Admin Calls',
  },
  hr: {
    spaceId: '90131759721',    // Resources & Trainings space
    folderName: 'HR Calls',
    listName: 'All HR Calls',
  },
  client: {
    spaceId: '901312664037',   // GROWTHGOD space
    folderName: 'Client Calls',
    listName: 'Client Calls',
  },
  general: {
    spaceId: '901312664037',   // GROWTHGOD space (catch-all)
    folderName: 'Meeting Notes',
    listName: 'General Calls',
  },
};

export const FALLBACK_ROUTE: SpaceRoute = {
  spaceId: '901312664037',    // GROWTHGOD
  folderName: 'Meeting Notes',
  listName: 'Needs Review',
};

export function getRoute(callType: CallType): SpaceRoute {
  return CALL_TYPE_ROUTES[callType] ?? FALLBACK_ROUTE;
}
