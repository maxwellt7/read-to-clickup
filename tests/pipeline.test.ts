import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    READ_AI_API_KEY: 'test-key',
    READ_AI_WEBHOOK_SECRET: 'test-secret',
    CLICKUP_API_KEY: 'test-key',
    CLICKUP_TEAM_ID: '9006105068',
    KV_REST_API_URL: 'https://example.com',
    KV_REST_API_TOKEN: 'test-token',
  },
}));

const mockGetMeeting = vi.hoisted(() => vi.fn());
vi.mock('@/lib/read-ai/client', () => ({
  getMeeting: mockGetMeeting,
  transcriptToText: vi.fn().mockReturnValue('Max: Hello\nJane: Hi'),
  transcriptExcerpt: vi.fn().mockReturnValue('Max: Hello'),
}));

const mockClassifyCall = vi.hoisted(() => vi.fn());
vi.mock('@/lib/classifier/index', () => ({
  classifyCall: mockClassifyCall,
}));

const mockExtract = vi.hoisted(() => vi.fn());
vi.mock('@/lib/classifier/extractor', () => ({
  extractMeetingIntelligence: mockExtract,
}));

const mockFindOrCreateFolder = vi.hoisted(() => vi.fn());
const mockFindOrCreateList = vi.hoisted(() => vi.fn());
vi.mock('@/lib/clickup/setup', () => ({
  findOrCreateFolder: mockFindOrCreateFolder,
  findOrCreateList: mockFindOrCreateList,
}));

const mockCreateMeetingDoc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/clickup/docs', () => ({
  createMeetingDoc: mockCreateMeetingDoc,
}));

const mockCreateActionItemTasks = vi.hoisted(() => vi.fn());
vi.mock('@/lib/clickup/tasks', () => ({
  createActionItemTasks: mockCreateActionItemTasks,
}));

const mockIsAlreadyProcessed = vi.hoisted(() => vi.fn());
const mockMarkAsProcessed = vi.hoisted(() => vi.fn());
vi.mock('@/lib/kv', () => ({
  isAlreadyProcessed: mockIsAlreadyProcessed,
  markAsProcessed: mockMarkAsProcessed,
}));

import { processMeeting } from '@/lib/pipeline';
import { leadershipMeeting } from './fixtures/sample-transcript';

const mockExtraction = {
  summary: ['Discussed Q2 strategy'],
  key_decisions: ['Approved hiring plan'],
  action_items: [{ task: 'Post job listings', assignee: 'Jane', due_hint: 'by Friday' }],
  participants: [{ name: 'Max Mayes', role: 'Owner' }],
  sentiment: 'positive' as const,
  topics: ['strategy', 'hiring'],
};

describe('processMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeeting.mockResolvedValue(leadershipMeeting);
    mockClassifyCall.mockResolvedValue({
      call_type: 'leadership',
      confidence: 0.9,
      suggested_title: 'Q2 Strategy Review',
    });
    mockExtract.mockResolvedValue(mockExtraction);
    mockFindOrCreateFolder.mockResolvedValue('folder-123');
    mockFindOrCreateList.mockResolvedValue('list-123');
    mockCreateMeetingDoc.mockResolvedValue({ id: 'doc-123', url: 'https://app.clickup.com/doc/doc-123' });
    mockCreateActionItemTasks.mockResolvedValue([
      { id: 'task-123', name: 'Post job listings', url: 'https://app.clickup.com/t/task-123', assignee: 'Jane' },
    ]);
    mockIsAlreadyProcessed.mockResolvedValue(false);
    mockMarkAsProcessed.mockResolvedValue(undefined);
  });

  it('returns a successful result with doc and tasks', async () => {
    const result = await processMeeting('meet-leadership-001');
    expect(result.success).toBe(true);
    expect(result.callType).toBe('leadership');
    expect(result.docId).toBe('doc-123');
    expect(result.tasksCreated).toBe(1);
    expect(result.alreadyProcessed).toBeUndefined();
  });

  it('returns already_processed for duplicate meeting IDs', async () => {
    mockIsAlreadyProcessed.mockResolvedValue(true);
    const result = await processMeeting('meet-leadership-001');
    expect(result.success).toBe(true);
    expect(result.alreadyProcessed).toBe(true);
    expect(mockClassifyCall).not.toHaveBeenCalled();
  });

  it('calls findOrCreateFolder and findOrCreateList', async () => {
    await processMeeting('meet-leadership-001');
    expect(mockFindOrCreateFolder).toHaveBeenCalledWith('901312664119', 'Meeting Notes');
    expect(mockFindOrCreateList).toHaveBeenCalledWith('folder-123', 'Leadership Calls');
  });

  it('marks meeting as processed after success', async () => {
    await processMeeting('meet-leadership-001');
    expect(mockMarkAsProcessed).toHaveBeenCalledWith('meet-leadership-001');
  });
});
