import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NormalizedMeetingDto } from '../dto/normalized-meeting.dto';
import { MeetingProvider } from '../entities/meeting-integration-connection.entity';

@Injectable()
export class ZoomProvider {
  private readonly logger = new Logger(ZoomProvider.name);
  private readonly baseUrl = 'https://api.zoom.us/v2';
  private readonly tokenUrl = 'https://zoom.us/oauth/token';

  constructor(private readonly httpService: HttpService) {}

  buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });
    return `https://zoom.us/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scopes: string;
    providerUserId?: string;
    tenantId?: string;
  }> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const { data }: any = await firstValueFrom(
      this.httpService.post(this.tokenUrl, body.toString(), {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    let providerUserId: string | undefined;
    let tenantId: string | undefined;
    try {
      const meResp: any = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/users/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        }),
      );
      providerUserId = meResp.data?.id;
      tenantId = meResp.data?.account_id;
    } catch {
      this.logger.warn(
        'Could not fetch Zoom user profile during token exchange',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scopes: data.scope,
      providerUserId,
      tenantId,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const { data }: any = await firstValueFrom(
      this.httpService.post(this.tokenUrl, body.toString(), {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async fetchMeetings(
    accessToken: string,
    _userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NormalizedMeetingDto[]> {
    // Use /users/me/meetings with type=upcoming.
    // IMPORTANT: type=upcoming does NOT support from/to params — date filtering is done client-side.
    // Required granular scope (Zoom 2024+): meeting:read:list_meetings
    const url = `${this.baseUrl}/users/me/meetings?type=upcoming&page_size=100`;

    try {
      const { data }: any = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      const meetings: any[] = data.meetings || [];

      // Client-side date range filter
      return meetings
        .filter((m) => {
          if (!m.start_time) return false;
          const start = new Date(m.start_time);
          return start >= startDate && start <= endDate;
        })
        .map((m) => this.normalize(m));
    } catch (err) {
      const zoomError = err?.response?.data;
      this.logger.error(
        `Zoom fetchMeetings error [code=${zoomError?.code}]: ${zoomError?.message ?? err?.message}`,
      );
      throw err;
    }
  }

  private normalize(meeting: any): NormalizedMeetingDto {
    const start = meeting.start_time
      ? new Date(meeting.start_time)
      : new Date();
    const durationMinutes = meeting.duration ?? null;
    const end = durationMinutes
      ? new Date(start.getTime() + durationMinutes * 60000)
      : null;

    return {
      externalId: String(meeting.id ?? meeting.uuid),
      provider: MeetingProvider.ZOOM,
      title: meeting.topic ?? '(No title)',
      startTime: start,
      endTime: end,
      durationMinutes,
      joinUrl: meeting.join_url ?? null,
      organizerEmail: meeting.host_email ?? null,
      attendees: [], // requires separate report:read API call
      rawData: meeting,
    };
  }
}
