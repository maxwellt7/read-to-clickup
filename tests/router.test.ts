import { describe, it, expect } from 'vitest';
import { getRoute, LOW_CONFIDENCE_THRESHOLD } from '@/lib/clickup/router';
import type { CallType } from '@/lib/read-ai/types';

describe('getRoute', () => {
  const cases: [CallType, string][] = [
    ['leadership', '901312664119'],
    ['sales', '901312939631'],
    ['operations', '90131759723'],
    ['creative', '901311249959'],
    ['admin', '901312664105'],
    ['hr', '90131759721'],
    ['client', '901312664037'],
    ['general', '901312664037'],
  ];

  cases.forEach(([callType, expectedSpaceId]) => {
    it(`routes ${callType} to spaceId ${expectedSpaceId}`, () => {
      const route = getRoute(callType);
      expect(route.spaceId).toBe(expectedSpaceId);
      expect(typeof route.folderName).toBe('string');
      expect(typeof route.listName).toBe('string');
    });
  });

  it('exports LOW_CONFIDENCE_THRESHOLD as 0.7', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.7);
  });
});
