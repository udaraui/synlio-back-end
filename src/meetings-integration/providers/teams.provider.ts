import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NormalizedMeetingDto } from '../dto/normalized-meeting.dto';
import { MeetingProvider } from '../entities/meeting-integration-connection.entity';

@Injectable()
export class TeamsProvider {
  private readonly logger = new Logger(TeamsProvider.name);
  private readonly graphBaseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Builds the Microsoft OAuth2 authorization URL.
   */
  buildAuthUrl(
    clientId: string,
    redirectUri: string,
    tenantId: string,
    state: string,
  ): string {
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'Calendars.Read',
      'OnlineMeetings.Read',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes,
      state,
    });

    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for access + refresh tokens.
   */
  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    tenantId: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scopes: string;
    tenantId: string;
    providerUserId?: string;
  }> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const { data }: any = await firstValueFrom(
      this.httpService.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        body.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    );

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Optionally fetch user profile to get providerUserId
    let providerUserId: string | undefined;
    try {
      const meResp: any = await firstValueFrom(
        this.httpService.get(`${this.graphBaseUrl}/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        }),
      );
      providerUserId = meResp.data?.id;
    } catch {
      this.logger.warn(
        'Could not fetch Teams user profile during token exchange',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scopes: data.scope,
      tenantId,
      providerUserId,
    };
  }

  /**
   * Refreshes an expired access token using the refresh token.
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    tenantId: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const { data }: any = await firstValueFrom(
      this.httpService.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        body.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Fetches calendar events (with Teams meeting links) for a date range.
   */
  async fetchMeetings(
    accessToken: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedMeetingDto[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const url = `${this.graphBaseUrl}/me/calendarView?startDateTime=${start}&endDateTime=${end}&$select=id,subject,start,end,onlineMeeting,organizer,attendees,isOnlineMeeting&$top=100`;

    try {
      const { data }: any = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      const events: any[] = data.value || [];
      return events
        .filter((e) => e.isOnlineMeeting || e.onlineMeeting?.joinUrl)
        .map((e) => this.normalize(e));
    } catch (err) {
      this.logger.error(
        'Teams fetchMeetings error',
        err?.response?.data ?? err?.message,
      );
      throw err;
    }
  }

  private normalize(event: any): NormalizedMeetingDto {
    const start = new Date(
      event.start?.dateTime + (event.start?.timeZone === 'UTC' ? 'Z' : ''),
    );
    const end = event.end?.dateTime
      ? new Date(
          event.end.dateTime + (event.end?.timeZone === 'UTC' ? 'Z' : ''),
        )
      : null;
    const durationMinutes =
      start && end
        ? Math.round((end.getTime() - start.getTime()) / 60000)
        : null;

    const attendees = (event.attendees || []).map((a: any) => ({
      email: a.emailAddress?.address ?? '',
      name: a.emailAddress?.name ?? undefined,
      responseStatus: a.status?.response ?? undefined,
    }));

    return {
      externalId: event.id,
      provider: MeetingProvider.TEAMS,
      title: event.subject ?? '(No title)',
      startTime: start,
      endTime: end,
      durationMinutes,
      joinUrl: event.onlineMeeting?.joinUrl ?? null,
      organizerEmail: event.organizer?.emailAddress?.address ?? null,
      attendees,
      rawData: event,
    };
  }
}
