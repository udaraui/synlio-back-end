import { MeetingProvider } from '../entities/meeting-integration-connection.entity';

export interface NormalizedAttendee {
  email: string;
  name?: string;
  responseStatus?: string; // 'accepted' | 'declined' | 'tentative' | 'needsAction'
  joined?: boolean;
}

export class NormalizedMeetingDto {
  externalId: string;
  provider: MeetingProvider;
  title: string;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  joinUrl: string | null;
  organizerEmail: string | null;
  attendees: NormalizedAttendee[];
  rawData: object;
}

export interface MeetingStatsDto {
  totalMeetings: number;
  totalMinutes: number;
  totalHours: number;
  byProvider: {
    provider: MeetingProvider;
    count: number;
    minutes: number;
  }[];
}
