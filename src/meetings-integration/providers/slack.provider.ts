import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NormalizedMeetingDto } from '../dto/normalized-meeting.dto';
import { MeetingProvider } from '../entities/meeting-integration-connection.entity';

/**
 * Slack provider — Note: Slack's Huddles/calls API is very limited.
 * We mainly surface call metadata. Full attendance is not available.
 */
@Injectable()
export class SlackProvider {
  private readonly logger = new Logger(SlackProvider.name);
  private readonly baseUrl = 'https://slack.com/api';
  private readonly authBaseUrl = 'https://slack.com/oauth/v2/authorize';
  private readonly tokenUrl = 'https://slack.com/api/oauth.v2.access';

  constructor(private readonly httpService: HttpService) {}

  buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
    const userScopes = ['calls:read', 'channels:history'].join(',');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      user_scope: userScopes,
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

    if (!data.ok) {
      throw new Error(`Slack token exchange failed: ${data.error}`);
    }

    // Slack tokens don't expire by default unless token rotation is enabled.
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    return {
      accessToken: data.authed_user?.access_token ?? data.access_token,
      refreshToken: data.authed_user?.refresh_token ?? '',
      expiresAt,
      scopes: data.authed_user?.scope ?? '',
      providerUserId: data.authed_user?.id,
      tenantId: data.team?.id,
    };
  }

  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    // Slack token rotation (only if enabled in app settings)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const { data }: any = await firstValueFrom(
      this.httpService.post(
        'https://slack.com/api/tooling.tokens.rotate',
        body.toString(),
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    );

    return {
      accessToken: data.token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.exp * 1000),
    };
  }

  /**
   * Fetches call metadata from Slack.
   * Note: Slack call history is not as rich as Teams/Zoom/Google Meet.
   */
  async fetchMeetings(
    accessToken: string,
    _startDate: Date,
    _endDate: Date,
  ): Promise<NormalizedMeetingDto[]> {
    // Slack doesn't have a "list calls in date range" endpoint.
    // The calls:read scope only allows fetching individual call info.
    // We return an empty array here — data will come in via webhook events in future.
    this.logger.warn(
      'Slack fetchMeetings: Slack API has no "list calls" endpoint. Returning empty array. Use webhooks/events for real-time data.',
    );
    return [];
  }

  private normalize(call: any): NormalizedMeetingDto {
    const start = call.date_start
      ? new Date(call.date_start * 1000)
      : new Date();
    const durationSeconds = call.duration ?? 0;
    const durationMinutes = Math.round(durationSeconds / 60);
    const end = new Date(start.getTime() + durationSeconds * 1000);

    return {
      externalId: call.id,
      provider: MeetingProvider.SLACK,
      title: call.title ?? 'Slack Huddle',
      startTime: start,
      endTime: end,
      durationMinutes,
      joinUrl: call.join_url ?? null,
      organizerEmail: null,
      attendees: [],
      rawData: call,
    };
  }
}
