import type { ReadAiMeeting } from '@/lib/read-ai/types';

export const leadershipMeeting: ReadAiMeeting = {
  id: 'meet-leadership-001',
  title: 'Q2 Strategy Review',
  start_time: '2026-04-19T10:00:00Z',
  end_time: '2026-04-19T10:45:00Z',
  duration_minutes: 45,
  recording_url: null,
  participants: [
    { name: 'Max Mayes', email: 'max@maxwellmayes.com' },
    { name: 'Jane Smith', email: 'jane@growthgod.com' },
  ],
  transcript: [
    { speaker: 'Max Mayes', text: 'Let\'s review our Q2 OKRs and strategic priorities.', start_time: 0 },
    { speaker: 'Jane Smith', text: 'I think we need to focus on the leadership team structure and long-term vision.', start_time: 10 },
    { speaker: 'Max Mayes', text: 'Agreed. The board expects us to have a clear succession plan by end of Q2.', start_time: 20 },
  ],
  summary: null,
};

export const salesMeeting: ReadAiMeeting = {
  id: 'meet-sales-001',
  title: 'Discovery Call - Acme Corp',
  start_time: '2026-04-19T14:00:00Z',
  end_time: '2026-04-19T14:30:00Z',
  duration_minutes: 30,
  recording_url: null,
  participants: [
    { name: 'Max Mayes', email: 'max@maxwellmayes.com' },
    { name: 'Bob Johnson', email: 'bob@acmecorp.com' },
  ],
  transcript: [
    { speaker: 'Max Mayes', text: 'Thanks for joining. Tell me about your current acquisition funnel.', start_time: 0 },
    { speaker: 'Bob Johnson', text: 'We\'re spending $50k a month on ads but our ROAS is only 1.8x. We need help.', start_time: 10 },
    { speaker: 'Max Mayes', text: 'We can definitely improve that. What\'s your average deal size and close rate?', start_time: 20 },
    { speaker: 'Bob Johnson', text: 'Our pipeline is around $200k and we close about 20% of proposals.', start_time: 35 },
  ],
  summary: null,
};

export const operationsMeeting: ReadAiMeeting = {
  id: 'meet-ops-001',
  title: 'Weekly Ops Standup',
  start_time: '2026-04-19T09:00:00Z',
  end_time: '2026-04-19T09:30:00Z',
  duration_minutes: 30,
  recording_url: null,
  participants: [
    { name: 'Max Mayes', email: 'max@maxwellmayes.com' },
    { name: 'Ops Lead', email: 'ops@growthgod.com' },
  ],
  transcript: [
    { speaker: 'Ops Lead', text: 'The client onboarding SOP is blocked — we need to update the Zapier workflow.', start_time: 0 },
    { speaker: 'Max Mayes', text: 'Let\'s prioritize that. What\'s the current bottleneck in the process?', start_time: 15 },
    { speaker: 'Ops Lead', text: 'The data handoff between the CRM and our delivery system. I\'ll fix it by Friday.', start_time: 25 },
  ],
  summary: null,
};
