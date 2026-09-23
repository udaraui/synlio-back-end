import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NormalizedMeetingDto } from '../dto/normalized-meeting.dto';
import { MeetingProvider } from '../entities/meeting-integration-connection.entity';
import {
  ProviderAuthError,
  throwClassifiedProviderError,
} from './provider-errors';

@Injectable()
export class GoogleMeetProvider {
  private readonly logger = new Logger(GoogleMeetProvider.name);
  private readonly calendarBaseUrl = 'https://www.googleapis.com/calendar/v3';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly authBaseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';

  constructor(private readonly httpService: HttpService) {}

  buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      // 'consent' is required on every connect: without it Google only returns a
      // refresh_token on the very first authorization, and a re-connect would
      // leave us with an access token that dies in an hour.
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    return `${this.authBaseUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date;
    scopes: string;
    providerUserId?: string;
    tenantId?: string;
  }> {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    let data: any;
    try {
      ({ data } = await firstValueFrom(
        this.httpService.post(this.tokenUrl, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      ));
    } catch (err) {
      throwClassifiedProviderError(
        MeetingProvider.GOOGLE_MEET,
        err,
        'Google authorization code exchange',
      );
    }

    if (!data.refresh_token) {
      // Without a refresh token the connection would silently die after ~1 hour.
      this.logger.warn(
        'Google did not return a refresh_token on code exchange — the existing one will be kept if present',
      );
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    let providerUserId: string | undefined;
    try {
      const meResp: any = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        }),
      );
      providerUserId = meResp.data?.id;
    } catch {
      this.logger.warn('Could not fetch Google user profile');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt,
      scopes: data.scope,
      providerUserId,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    if (!refreshToken) {
      throw new ProviderAuthError(
        MeetingProvider.GOOGLE_MEET,
        'No Google refresh token stored. Please reconnect your Google account.',
        'missing_refresh_token',
      );
    }

    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });

    let data: any;
    try {
      ({ data } = await firstValueFrom(
        this.httpService.post(this.tokenUrl, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      ));
    } catch (err) {
      // A 400 here is almost always `invalid_grant`: the refresh token was
      // revoked, the user changed their password, or — most commonly — the
      // OAuth consent screen is still in "Testing" mode, where Google expires
      // refresh tokens after 7 days.
      throwClassifiedProviderError(
        MeetingProvider.GOOGLE_MEET,
        err,
        'Google token refresh',
      );
    }

    return {
      accessToken: data.access_token,
      // Google usually omits refresh_token on refresh, but issues a new one when
      // it rotates the grant — keep whichever is current.
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async fetchMeetings(
    accessToken: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedMeetingDto[]> {
    try {
      const items: any[] = [];
      let pageToken: string | undefined;

      // Google caps a page at 250 events; follow nextPageToken so a busy
      // calendar isn't silently truncated.
      do {
        const params = new URLSearchParams({
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
          ...(pageToken ? { pageToken } : {}),
        });

        const { data }: any = await firstValueFrom(
          this.httpService.get(
            `${this.calendarBaseUrl}/calendars/primary/events?${params.toString()}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          ),
        );

        items.push(...(data.items ?? []));
        pageToken = data.nextPageToken;
      } while (pageToken);

      return items.filter((e) => this.isSyncableEvent(e)).map((e) => this.normalize(e));
    } catch (err) {
      this.logger.error(
        'Google Meet fetchMeetings error',
        JSON.stringify(err?.response?.data ?? err?.message),
      );
      throwClassifiedProviderError(
        MeetingProvider.GOOGLE_MEET,
        err,
        'Google Calendar events fetch',
      );
    }
  }

  /**
   * Which calendar events count as meetings.
   *
   * Deliberately NOT limited to events carrying Google Meet conferenceData —
   * a calendar entry with a Zoom/Teams link, a dial-in, or no link at all is
   * still time spent in a meeting and belongs in Pulse.
   *
   * Excluded:
   *  - cancelled events (tombstones returned by singleEvents=true)
   *  - all-day events (start.date instead of start.dateTime) — holidays, PTO
   *    and birthdays are not meetings, and a 1440-minute "duration" would
   *    wreck the total-hours stat on the Pulse cards
   *  - events the user declined
   */
  private isSyncableEvent(event: any): boolean {
    if (event.status === 'cancelled') return false;
    if (!event.start?.dateTime) return false;

    const self = (event.attendees ?? []).find((a: any) => a.self);
    if (self?.responseStatus === 'declined') return false;

    return true;
  }

  /** Best available join link: Meet, then the legacy hangout link, then a URL in `location`. */
  private extractJoinUrl(event: any): string | null {
    const entryPoints: any[] = event.conferenceData?.entryPoints ?? [];
    const videoEntry = entryPoints.find((ep) => ep.entryPointType === 'video');
    if (videoEntry?.uri) return videoEntry.uri;
    if (entryPoints[0]?.uri) return entryPoints[0].uri;
    if (event.hangoutLink) return event.hangoutLink;
    // Zoom/Teams invites commonly arrive as a bare URL in the location field.
    if (typeof event.location === 'string' && /^https?:\/\//i.test(event.location.trim())) {
      return event.location.trim();
    }
    return null;
  }

  private normalize(event: any): NormalizedMeetingDto {
    const startStr = event.start?.dateTime ?? event.start?.date;
    const endStr = event.end?.dateTime ?? event.end?.date;
    const start = startStr ? new Date(startStr) : new Date();
    const end = endStr ? new Date(endStr) : null;
    const durationMinutes =
      start && end
        ? Math.round((end.getTime() - start.getTime()) / 60000)
        : null;

    const joinUrl = this.extractJoinUrl(event);

    const attendees = (event.attendees || []).map((a: any) => ({
      email: a.email ?? '',
      name: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
    }));

    return {
      // Must be event.id, not conferenceData.conferenceId: every instance of a
      // recurring meeting shares one conferenceId, so keying on it made all
      // occurrences upsert onto a single row and only the last one survived.
      externalId: event.id,
      provider: MeetingProvider.GOOGLE_MEET,
      title: event.summary ?? '(No title)',
      startTime: start,
      endTime: end,
      durationMinutes,
      joinUrl,
      organizerEmail: event.organizer?.email ?? null,
      attendees,
      rawData: event,
    };
  }
}
