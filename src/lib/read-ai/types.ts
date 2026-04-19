export type CallType =
  | 'leadership'
  | 'sales'
  | 'operations'
  | 'creative'
  | 'admin'
  | 'hr'
  | 'client'
  | 'general';

export interface ReadAiWebhookPayload {
  event_type: 'meeting.completed';
  payload: {
    meeting_id: string;
  };
}

export interface ReadAiParticipant {
  name: string;
  email: string;
}

export interface ReadAiTranscriptEntry {
  speaker: string;
  text: string;
  start_time: number; // seconds
}

export interface ReadAiMeeting {
  id: string;
  title: string;
  start_time: string;      // ISO 8601
  end_time: string;        // ISO 8601
  duration_minutes: number;
  recording_url: string | null;
  participants: ReadAiParticipant[];
  transcript: ReadAiTranscriptEntry[];
  summary: string | null;
}
