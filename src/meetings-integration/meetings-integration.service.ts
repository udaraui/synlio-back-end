import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  MeetingIntegrationConnection,
  MeetingProvider,
  ConnectionStatus,
} from './entities/meeting-integration-connection.entity';
import { Meeting, MeetingStatus } from './entities/meeting.entity';
import { MeetingAttendee } from './entities/meeting-attendee.entity';
import { MeetingSyncState, SyncStatus } from './entities/meeting-sync-state.entity';
import { MeetingActionState, MeetingActionStateEnum } from './entities/meeting-action-state.entity';
import { NormalizedMeetingDto, MeetingStatsDto } from './dto/normalized-meeting.dto';
import { UpdateMeetingActualTimesDto } from './dto/update-meeting-actual-times.dto';
import { UpdateMeetingActualDurationDto } from './dto/update-meeting-actual-duration.dto';
import { SetMeetingActionStateDto } from './dto/set-meeting-action-state.dto';
import { CreateInternalMeetingDto } from './dto/create-internal-meeting.dto';
import { UpdateInternalMeetingDto } from './dto/update-internal-meeting.dto';
import { TeamsProvider } from './providers/teams.provider';
import { ZoomProvider } from './providers/zoom.provider';
import { GoogleMeetProvider } from './providers/google-meet.provider';
import { SlackProvider } from './providers/slack.provider';
import {
  ProviderAuthError,
  isUnauthorized,
} from './providers/provider-errors';
import * as crypto from 'crypto';

@Injectable()
export class MeetingsIntegrationService {
  private readonly logger = new Logger(MeetingsIntegrationService.name);

  constructor(
    @InjectRepository(MeetingIntegrationConnection)
    private readonly connectionRepo: Repository<MeetingIntegrationConnection>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingAttendee)
    private readonly attendeeRepo: Repository<MeetingAttendee>,
    @InjectRepository(MeetingSyncState)
    private readonly syncStateRepo: Repository<MeetingSyncState>,
    @InjectRepository(MeetingActionState)
    private readonly actionStateRepo: Repository<MeetingActionState>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly teamsProvider: TeamsProvider,
    private readonly zoomProvider: ZoomProvider,
    private readonly googleMeetProvider: GoogleMeetProvider,
    private readonly slackProvider: SlackProvider,
  ) {}

  // ─── OAuth URL Generation ─────────────────────────────────────────────────

  /**
   * The OAuth redirect URI must be byte-identical to the one registered with the
   * provider, so it is derived from a single explicit BACKEND_URL rather than
   * guessed from the incoming request.
   */
  private buildRedirectUri(provider: MeetingProvider): string {
    const backendUrl = this.configService.get<string>('BACKEND_URL');
    if (!backendUrl) {
      throw new InternalServerErrorException(
        'BACKEND_URL is not configured. Set it to this API\'s public base URL ' +
          '(e.g. http://localhost:4000) — OAuth redirect URIs cannot be built without it',
      );
    }
    return `${backendUrl.replace(/\/+$/, '')}/meetings-integration/callback/${provider}`;
  }

  getAuthUrl(provider: MeetingProvider, userId: number): string {
    const state = this.buildState(provider, userId);
    const redirectUri = this.buildRedirectUri(provider);

    switch (provider) {
      case MeetingProvider.TEAMS: {
        const clientId = this.configService.getOrThrow<string>('TEAMS_CLIENT_ID');
        const tenantId = this.configService.get<string>('TEAMS_TENANT_ID', 'common');
        return this.teamsProvider.buildAuthUrl(clientId, redirectUri, tenantId, state);
      }
      case MeetingProvider.ZOOM: {
        const clientId = this.configService.getOrThrow<string>('ZOOM_CLIENT_ID');
        return this.zoomProvider.buildAuthUrl(clientId, redirectUri, state);
      }
      case MeetingProvider.GOOGLE_MEET: {
        const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
        return this.googleMeetProvider.buildAuthUrl(clientId, redirectUri, state);
      }
      case MeetingProvider.SLACK: {
        const clientId = this.configService.getOrThrow<string>('SLACK_CLIENT_ID');
        return this.slackProvider.buildAuthUrl(clientId, redirectUri, state);
      }
      default:
        throw new BadRequestException(`Unknown provider: ${provider}`);
    }
  }

  // ─── OAuth Callback ────────────────────────────────────────────────────────

  async handleCallback(
    provider: MeetingProvider,
    code: string,
    state: string,
  ): Promise<{ userId: number; provider: MeetingProvider }> {
    const { userId } = this.parseState(state, provider);
    const redirectUri = this.buildRedirectUri(provider);

    let tokenData: {
      accessToken: string;
      refreshToken: string | null;
      expiresAt: Date;
      scopes: string;
      providerUserId?: string;
      tenantId?: string;
    };

    switch (provider) {
      case MeetingProvider.TEAMS: {
        const clientId = this.configService.getOrThrow<string>('TEAMS_CLIENT_ID');
        const clientSecret = this.configService.getOrThrow<string>('TEAMS_CLIENT_SECRET');
        const tenantId = this.configService.get<string>('TEAMS_TENANT_ID', 'common');
        tokenData = await this.teamsProvider.exchangeCodeForTokens(
          code, clientId, clientSecret, redirectUri, tenantId,
        );
        tokenData.tenantId = tenantId;
        break;
      }
      case MeetingProvider.ZOOM: {
        const clientId = this.configService.getOrThrow<string>('ZOOM_CLIENT_ID');
        const clientSecret = this.configService.getOrThrow<string>('ZOOM_CLIENT_SECRET');
        tokenData = await this.zoomProvider.exchangeCodeForTokens(
          code, clientId, clientSecret, redirectUri,
        );
        break;
      }
      case MeetingProvider.GOOGLE_MEET: {
        const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
        const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
        tokenData = await this.googleMeetProvider.exchangeCodeForTokens(
          code, clientId, clientSecret, redirectUri,
        );
        break;
      }
      case MeetingProvider.SLACK: {
        const clientId = this.configService.getOrThrow<string>('SLACK_CLIENT_ID');
        const clientSecret = this.configService.getOrThrow<string>('SLACK_CLIENT_SECRET');
        tokenData = await this.slackProvider.exchangeCodeForTokens(
          code, clientId, clientSecret, redirectUri,
        );
        break;
      }
      default:
        throw new BadRequestException(`Unknown provider: ${provider}`);
    }

    // Upsert connection record
    const existing = await this.connectionRepo.findOne({
      where: { userId, provider },
    });

    if (existing) {
      existing.accessToken = tokenData.accessToken;
      // Never clobber a working refresh token with an undefined one — some
      // providers only return refresh_token on the first authorization.
      existing.refreshToken = tokenData.refreshToken ?? existing.refreshToken;
      existing.expiresAt = tokenData.expiresAt;
      existing.scopes = tokenData.scopes;
      existing.providerUserId = tokenData.providerUserId ?? existing.providerUserId;
      existing.tenantId = tokenData.tenantId ?? existing.tenantId;
      existing.status = ConnectionStatus.CONNECTED;
      existing.lastConnectedAt = new Date();
      existing.lastError = null;
      existing.updatedBy = userId.toString();
      await this.connectionRepo.save(existing);
    } else {
      await this.connectionRepo.save(
        this.connectionRepo.create({
          userId,
          provider,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: tokenData.expiresAt,
          scopes: tokenData.scopes,
          providerUserId: tokenData.providerUserId,
          tenantId: tokenData.tenantId,
          status: ConnectionStatus.CONNECTED,
          lastConnectedAt: new Date(),
          createdBy: userId.toString(),
          updatedBy: userId.toString(),
        }),
      );
    }

    return { userId, provider };
  }

  // ─── Disconnect ────────────────────────────────────────────────────────────

  async disconnect(provider: MeetingProvider, userId: number): Promise<void> {
    const connection = await this.connectionRepo.findOne({
      where: { userId, provider },
    });
    if (!connection) return;
    connection.status = ConnectionStatus.REVOKED;
    connection.accessToken = '';
    connection.refreshToken = null;
    connection.updatedBy = userId.toString();
    await this.connectionRepo.save(connection);
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  async getConnectionStatus(userId: number): Promise<
    {
      provider: MeetingProvider;
      status: ConnectionStatus;
      lastConnectedAt: Date | null;
      lastSyncAt: Date | null;
      lastError: string | null;
    }[]
  > {
    const allProviders = Object.values(MeetingProvider);
    const connections = await this.connectionRepo.find({ where: { userId } });
    const connectionMap = new Map(connections.map((c) => [c.provider, c]));

    return allProviders.map((provider) => {
      const conn = connectionMap.get(provider);
      return {
        provider,
        status: conn?.status ?? ConnectionStatus.REVOKED,
        lastConnectedAt: conn?.lastConnectedAt ?? null,
        lastSyncAt: conn?.lastSyncAt ?? null,
        lastError: conn?.lastError ?? null,
      };
    });
  }

  // ─── Token Refresh ────────────────────────────────────────────────────────

  /**
   * Returns a usable access token, refreshing it when it is close to expiry.
   *
   * @param force refresh even if the stored expiry says the token is still
   *              valid — used after the provider rejects a call with 401,
   *              which happens when the token died earlier than advertised
   *              (clock skew, password change, token revoked elsewhere).
   */
  async ensureFreshToken(
    connection: MeetingIntegrationConnection,
    force = false,
  ): Promise<string> {
    const now = new Date();
    // 5-minute skew window: refreshing slightly early is free, being a minute
    // late means a failed sync and a connection wrongly marked broken.
    const isExpired =
      connection.expiresAt &&
      connection.expiresAt <= new Date(now.getTime() + 5 * 60000);

    if (!isExpired && !force) return connection.accessToken;

    if (!connection.refreshToken) {
      throw new ProviderAuthError(
        connection.provider,
        `No refresh token stored for ${connection.provider}. Please reconnect`,
        'missing_refresh_token',
      );
    }

    this.logger.log(`Refreshing ${connection.provider} token for user ${connection.userId}`);

    let refreshed: { accessToken: string; refreshToken: string; expiresAt: Date };

    switch (connection.provider) {
      case MeetingProvider.TEAMS: {
        const clientId = this.configService.getOrThrow<string>('TEAMS_CLIENT_ID');
        const clientSecret = this.configService.getOrThrow<string>('TEAMS_CLIENT_SECRET');
        const tenantId = connection.tenantId ?? 'common';
        refreshed = await this.teamsProvider.refreshAccessToken(
          connection.refreshToken!, clientId, clientSecret, tenantId,
        );
        break;
      }
      case MeetingProvider.ZOOM: {
        const clientId = this.configService.getOrThrow<string>('ZOOM_CLIENT_ID');
        const clientSecret = this.configService.getOrThrow<string>('ZOOM_CLIENT_SECRET');
        refreshed = await this.zoomProvider.refreshAccessToken(
          connection.refreshToken!, clientId, clientSecret,
        );
        break;
      }
      case MeetingProvider.GOOGLE_MEET: {
        const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
        const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
        refreshed = await this.googleMeetProvider.refreshAccessToken(
          connection.refreshToken!, clientId, clientSecret,
        );
        break;
      }
      case MeetingProvider.SLACK: {
        const clientId = this.configService.getOrThrow<string>('SLACK_CLIENT_ID');
        const clientSecret = this.configService.getOrThrow<string>('SLACK_CLIENT_SECRET');
        refreshed = await this.slackProvider.refreshAccessToken(
          connection.refreshToken!, clientId, clientSecret,
        );
        break;
      }
      default:
        return connection.accessToken;
    }

    connection.accessToken = refreshed.accessToken;
    connection.refreshToken = refreshed.refreshToken;
    connection.expiresAt = refreshed.expiresAt;
    await this.connectionRepo.save(connection);

    return refreshed.accessToken;
  }

  // ─── Sync Meetings ────────────────────────────────────────────────────────

  async syncMeetings(
    userId: number,
    provider?: MeetingProvider,
    startDate?: Date,
    endDate?: Date,
    syncedBy?: string,
  ): Promise<{ synced: number; provider: string }[]> {
    const start = startDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const where: any = { userId };
    if (provider) {
      where.provider = provider;
    } else {
      where.status = ConnectionStatus.CONNECTED;
    }

    const connections = await this.connectionRepo.find({ where });

    // ── Admin consent gate ───────────────────────────────────────────────────
    // Only sync providers that the user's company has given admin consent for.
    const allowedProviders = await this.getAllowedProvidersForUser(userId);
    // ────────────────────────────────────────────────────────────────────────

    const results: { synced: number; provider: string }[] = [];

    for (const conn of connections) {
      // Skip providers the admin has removed consent for
      if (allowedProviders.length > 0 && !allowedProviders.includes(conn.provider)) {
        this.logger.warn(
          `Skipping ${conn.provider} sync for user ${userId} — not in company allowedMeetingProviders`,
        );
        continue;
      }

      try {
        let accessToken = await this.ensureFreshToken(conn);
        let normalized: NormalizedMeetingDto[];

        try {
          normalized = await this.fetchProviderMeetings(conn, accessToken, start, end);
        } catch (err) {
          // The stored expiry claimed the token was still good but the provider
          // disagreed. Force one refresh and retry before giving up — this alone
          // removes most spurious "reconnect required" prompts.
          if (!isUnauthorized(err)) throw err;
          this.logger.warn(
            `${conn.provider} returned 401 for user ${userId} — forcing token refresh and retrying`,
          );
          accessToken = await this.ensureFreshToken(conn, true);
          normalized = await this.fetchProviderMeetings(conn, accessToken, start, end);
        }

        const synced = await this.upsertMeetings(userId, normalized, syncedBy);
        await this.updateSyncState(userId, conn.provider, SyncStatus.OK, undefined, syncedBy);
        conn.lastSyncAt = new Date();
        conn.status = ConnectionStatus.CONNECTED;
        conn.lastError = null;
        await this.connectionRepo.save(conn);
        results.push({ synced, provider: conn.provider });
      } catch (err) {
        const errMsg = err?.message ?? 'Unknown error';
        const requiresReauth = err instanceof ProviderAuthError;

        this.logger.error(
          `Sync failed for ${conn.provider} (user ${userId}, reauth=${requiresReauth})`,
          errMsg,
        );
        await this.updateSyncState(userId, conn.provider, SyncStatus.ERROR, errMsg, syncedBy);

        // Only a dead grant justifies dropping the connection. Transient
        // failures (network, 429, 5xx) keep the connection CONNECTED so the
        // next scheduled sync recovers on its own and the user is not asked
        // to re-authorize for a problem that fixes itself.
        conn.status = requiresReauth ? ConnectionStatus.ERROR : ConnectionStatus.CONNECTED;
        conn.lastError = errMsg;
        await this.connectionRepo.save(conn);
        results.push({ synced: 0, provider: conn.provider });
      }
    }

    // Update internal meeting statuses in DB since they have no external sync source
    await this.syncInternalMeetingStatuses(userId);

    return results;
  }

  private async fetchProviderMeetings(
    conn: MeetingIntegrationConnection,
    accessToken: string,
    start: Date,
    end: Date,
  ): Promise<NormalizedMeetingDto[]> {
    switch (conn.provider) {
      case MeetingProvider.TEAMS:
        return this.teamsProvider.fetchMeetings(accessToken, start, end);
      case MeetingProvider.ZOOM:
        return this.zoomProvider.fetchMeetings(
          accessToken, conn.providerUserId ?? 'me', start, end,
        );
      case MeetingProvider.GOOGLE_MEET:
        return this.googleMeetProvider.fetchMeetings(accessToken, start, end);
      case MeetingProvider.SLACK:
        return this.slackProvider.fetchMeetings(accessToken, start, end);
      default:
        return [];
    }
  }

  /**
   * Corrects the status of all internal meetings for a user based on current time.
   * Called after every sync so statuses stay accurate without external provider data.
   */
  private async syncInternalMeetingStatuses(userId: number): Promise<void> {
    const now = new Date();

    // Update meetings that should be ENDED
    await this.meetingRepo
      .createQueryBuilder()
      .update(Meeting)
      .set({ status: MeetingStatus.ENDED, updatedBy: 'system' })
      .where('ownerUserId = :userId', { userId })
      .andWhere('provider = :provider', { provider: MeetingProvider.INTERNAL })
      .andWhere('status != :ended', { ended: MeetingStatus.ENDED })
      .andWhere(
        '(COALESCE("actualEndTime", "scheduledEndTime") IS NOT NULL AND COALESCE("actualEndTime", "scheduledEndTime") < :now)',
        { now },
      )
      .execute();

    // Update meetings that should be ONGOING
    await this.meetingRepo
      .createQueryBuilder()
      .update(Meeting)
      .set({ status: MeetingStatus.ONGOING, updatedBy: 'system' })
      .where('ownerUserId = :userId', { userId })
      .andWhere('provider = :provider', { provider: MeetingProvider.INTERNAL })
      .andWhere('status != :ended', { ended: MeetingStatus.ENDED })
      .andWhere('COALESCE("actualStartTime", "scheduledStartTime") <= :now', { now })
      .andWhere(
        '(COALESCE("actualEndTime", "scheduledEndTime") IS NULL OR COALESCE("actualEndTime", "scheduledEndTime") >= :now)',
        { now },
      )
      .execute();

    // Update meetings that should be SCHEDULED (future meetings currently marked otherwise)
    await this.meetingRepo
      .createQueryBuilder()
      .update(Meeting)
      .set({ status: MeetingStatus.SCHEDULED, updatedBy: 'system' })
      .where('ownerUserId = :userId', { userId })
      .andWhere('provider = :provider', { provider: MeetingProvider.INTERNAL })
      .andWhere('status = :ongoing', { ongoing: MeetingStatus.ONGOING })
      .andWhere('COALESCE("actualStartTime", "scheduledStartTime") > :now', { now })
      .execute();
  }

  /**
   * Returns the allowedMeetingProviders for the company the user belongs to.
   * Falls back to all providers if no company / no setting found.
   */
  private async getAllowedProvidersForUser(userId: number): Promise<MeetingProvider[]> {
    try {
      const rows = await this.dataSource.query(
        `SELECT c."allowedMeetingProviders"
         FROM public."user" u
         JOIN public.company c ON c.id = u."defaultCompanyId"
         WHERE u.id = $1
         LIMIT 1`,
        [userId],
      );
      if (!rows?.length || !rows[0].allowedMeetingProviders) return [];
      // Column is stored as comma-separated text
      const raw: string = rows[0].allowedMeetingProviders;
      return raw.split(',').map((p) => p.trim()) as MeetingProvider[];
    } catch (err) {
      this.logger.warn(`getAllowedProvidersForUser failed for user ${userId}: ${err?.message}`);
      return []; // Empty = no restriction (fail open)
    }
  }

  private async upsertMeetings(
    userId: number,
    normalized: NormalizedMeetingDto[],
    syncedBy?: string,
  ): Promise<number> {
    let count = 0;
    for (const dto of normalized) {
      try {
        const existing = await this.meetingRepo.findOne({
          where: {
            provider: dto.provider,
            externalId: dto.externalId,
            ownerUserId: userId,
          },
        });

        const durationMinutes =
          dto.durationMinutes ??
          (dto.endTime
            ? Math.round((dto.endTime.getTime() - dto.startTime.getTime()) / 60000)
            : null);

        const meetingData = {
          provider: dto.provider,
          externalId: dto.externalId,
          ownerUserId: userId,
          title: dto.title,
          // Legacy columns — keep in sync with scheduled columns
          startTime: dto.startTime,
          endTime: dto.endTime,
          // Scheduled times — authoritative provider data, never overwritten by edits
          scheduledStartTime: dto.startTime,
          scheduledEndTime: dto.endTime,
          durationMinutes,
          joinUrl: dto.joinUrl,
          organizerEmail: dto.organizerEmail,
          status: this.inferStatus(dto),
          providerMetadata: dto.rawData,
          syncedAt: new Date(),
        };

        if (existing) {
          // Preserve actual times if user has edited them
          const preserveActual = {
            actualStartTime: existing.actualStartTime,
            actualEndTime: existing.actualEndTime,
          };
          Object.assign(existing, meetingData, preserveActual);
          if (syncedBy) existing.updatedBy = syncedBy;
          await this.meetingRepo.save(existing);
        } else {
          await this.meetingRepo.save(
            this.meetingRepo.create({
              ...meetingData,
              actualStartTime: null,
              actualEndTime: null,
              ...(syncedBy && { createdBy: syncedBy, updatedBy: syncedBy }),
            }),
          );
        }

        // Re-fetch to get saved meeting id
        const savedMeeting = await this.meetingRepo.findOne({
          where: { provider: dto.provider, externalId: dto.externalId, ownerUserId: userId },
        });

        // Upsert attendees
        if (dto.attendees?.length && savedMeeting) {
          await this.attendeeRepo.delete({ meetingId: savedMeeting.id });
          const attendees = dto.attendees.map((a) =>
            this.attendeeRepo.create({
              meetingId: savedMeeting.id!,
              email: a.email,
              name: a.name ?? null,
              responseStatus: a.responseStatus ?? null,
              joined: a.joined ?? null,
              ...(syncedBy && { createdBy: syncedBy, updatedBy: syncedBy }),
            }),
          );
          await this.attendeeRepo.save(attendees);
        }

        count++;
      } catch (err) {
        this.logger.warn(`Failed to upsert meeting ${dto.externalId}: ${err?.message}`);
      }
    }
    return count;
  }

  private inferStatus(dto: NormalizedMeetingDto): MeetingStatus {
    const now = new Date();
    if (!dto.startTime) return MeetingStatus.SCHEDULED;
    if (dto.endTime && dto.endTime < now) return MeetingStatus.ENDED;
    if (dto.startTime <= now && (!dto.endTime || dto.endTime >= now)) return MeetingStatus.ONGOING;
    return MeetingStatus.SCHEDULED;
  }

  private async updateSyncState(
    userId: number,
    provider: MeetingProvider,
    status: SyncStatus,
    error?: string,
    syncedBy?: string,
  ): Promise<void> {
    const existing = await this.syncStateRepo.findOne({
      where: { userId, provider },
    });
    if (existing) {
      existing.lastSyncAt = new Date();
      existing.lastStatus = status;
      existing.lastError = error ?? null;
      if (syncedBy) existing.updatedBy = syncedBy;
      await this.syncStateRepo.save(existing);
    } else {
      await this.syncStateRepo.save(
        this.syncStateRepo.create({
          userId,
          provider,
          lastSyncAt: new Date(),
          lastStatus: status,
          lastError: error ?? null,
          ...(syncedBy && { createdBy: syncedBy, updatedBy: syncedBy }),
        }),
      );
    }
  }

  // ─── Get Meetings ─────────────────────────────────────────────────────────

  async getMeetings(
    userId: number,
    query: {
      startDate?: string;
      endDate?: string;
      provider?: MeetingProvider;
      page?: number;
      limit?: number;
      includeIgnored?: boolean;
    },
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50)));
    const skip = (page - 1) * limit;

    const qb = this.meetingRepo
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.attendees', 'attendee')
      .leftJoinAndSelect(
        'meeting.actionStates',
        'actionState',
        'actionState.actedByUserId = :userId',
        { userId },
      )
      // Include meetings where user is the owner.
      // Attendee visibility is handled by the fanout rows created in createInternalMeeting.
      .where('meeting.ownerUserId = :userId', { userId })
      .orderBy('meeting.scheduledStartTime', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.startDate) {
      qb.andWhere('meeting.scheduledStartTime >= :startDate', { startDate: new Date(query.startDate) });
    }
    if (query.endDate) {
      qb.andWhere('meeting.scheduledStartTime <= :endDate', { endDate: new Date(query.endDate) });
    }
    if (query.provider) {
      qb.andWhere('meeting.provider = :provider', { provider: query.provider });
    }
    // By default exclude ignored meetings
    if (!query.includeIgnored) {
      qb.andWhere(
        `(actionState.state IS NULL OR actionState.state != 'ignored')`,
      );
    }

    const [meetings, total] = await qb.getManyAndCount();

    // Fetch task codes for linked tasks
    const taskIds = meetings
      .map(m => (m as any).actionStates?.[0]?.taskId)
      .filter(id => id != null);

    let taskCodes: Record<number, string> = {};
    if (taskIds.length > 0) {
      const tasks = await this.meetingRepo.manager.query(
        `SELECT id, code FROM tm_task WHERE id = ANY($1)`,
        [taskIds]
      );
      taskCodes = tasks.reduce((acc: any, t: any) => ({ ...acc, [t.id]: t.code }), {});
    }

    // Map to response shape — attach actionState and effective duration
    const data = meetings.map((m) => {
      const actionState = (m as any).actionStates?.[0] ?? null;
      const effectiveStartTime = m.actualStartTime ?? m.scheduledStartTime;
      const effectiveEndTime = m.actualEndTime ?? m.scheduledEndTime;
      // Priority: actualDurationMinutes > durationMinutes
      const effectiveDurationMinutes = m.actualDurationMinutes ?? m.durationMinutes ?? null;

      // For internal meetings, dynamically compute status from current time
      // since internal meetings are not synced from external providers
      let status = m.status;
      if (m.provider === MeetingProvider.INTERNAL && effectiveStartTime) {
        const now = new Date();
        if (effectiveEndTime && now > effectiveEndTime) {
          status = MeetingStatus.ENDED;
        } else if (now >= effectiveStartTime && (!effectiveEndTime || now <= effectiveEndTime)) {
          status = MeetingStatus.ONGOING;
        } else {
          status = MeetingStatus.SCHEDULED;
        }
      }

      return {
        ...m,
        status,
        scheduledStartTime: m.scheduledStartTime,
        scheduledEndTime: m.scheduledEndTime,
        actualStartTime: m.actualStartTime ?? null,
        actualEndTime: m.actualEndTime ?? null,
        effectiveStartTime,
        effectiveEndTime,
        effectiveDurationMinutes,
        actionState: actionState?.state ?? MeetingActionStateEnum.NONE,
        linkedTaskId: actionState?.taskId ?? null,
        linkedTaskCode: actionState?.taskId ? taskCodes[actionState.taskId] : null,
        actionStates: undefined, // remove raw array
      };
    });

    return { data, total, page, limit };
  }

  // ─── Meeting Stats (for Pulse page) ──────────────────────────────────────

  async getMeetingStats(
    userId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<MeetingStatsDto> {
    const qb = this.meetingRepo
      .createQueryBuilder('meeting')
      .leftJoinAndSelect(
        'meeting.actionStates',
        'actionState',
        'actionState.actedByUserId = :userId',
        { userId },
      )
      .where('meeting.ownerUserId = :userId', { userId })
      // Exclude ignored meetings from stats
      .andWhere(`(actionState.state IS NULL OR actionState.state != 'ignored')`);

    if (startDate) {
      qb.andWhere('meeting.scheduledStartTime >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      qb.andWhere('meeting.scheduledStartTime <= :endDate', { endDate: new Date(endDate) });
    }

    const meetings = await qb.getMany();

    let totalMinutes = 0;
    const providerMap = new Map<MeetingProvider, { count: number; minutes: number }>();

    for (const m of meetings) {
      // Priority: actualDurationMinutes > durationMinutes (from provider)
      const duration = m.actualDurationMinutes ?? m.durationMinutes ?? 0;

      totalMinutes += duration;
      const existing = providerMap.get(m.provider) ?? { count: 0, minutes: 0 };
      providerMap.set(m.provider, {
        count: existing.count + 1,
        minutes: existing.minutes + duration,
      });
    }

    const byProvider = Array.from(providerMap.entries()).map(([provider, stat]) => ({
      provider,
      count: stat.count,
      minutes: stat.minutes,
    }));

    return {
      totalMeetings: meetings.length,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      byProvider,
    };
  }

  // ─── Update Actual Times (kept for future use) ───────────────────────────

  async updateMeetingActualTimes(
    meetingId: number,
    userId: number,
    dto: UpdateMeetingActualTimesDto,
  ): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException(`Meeting #${meetingId} not found`);
    if (meeting.ownerUserId !== userId) throw new ForbiddenException('Not your meeting');

    meeting.actualStartTime = new Date(dto.actualStartTime);
    meeting.actualEndTime = new Date(dto.actualEndTime);
    meeting.updatedBy = userId.toString();
    return this.meetingRepo.save(meeting);
  }

  // ─── Update Actual Duration ───────────────────────────────────────────────

  async updateMeetingActualDuration(
    meetingId: number,
    userId: number,
    dto: UpdateMeetingActualDurationDto,
  ): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException(`Meeting #${meetingId} not found`);
    if (meeting.ownerUserId !== userId) throw new ForbiddenException('Not your meeting');

    // Setting to 0 clears the actual duration (falls back to scheduled)
    meeting.actualDurationMinutes = dto.actualDurationMinutes === 0 ? null : dto.actualDurationMinutes;
    meeting.updatedBy = userId.toString();
    return this.meetingRepo.save(meeting);
  }

  // ─── Set Action State ─────────────────────────────────────────────────────

  async setMeetingActionState(
    meetingId: number,
    userId: number,
    dto: SetMeetingActionStateDto,
  ): Promise<MeetingActionState> {
    const meeting = await this.meetingRepo.findOne({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException(`Meeting #${meetingId} not found`);
    if (meeting.ownerUserId !== userId) throw new ForbiddenException('Not your meeting');

    let actionState = await this.actionStateRepo.findOne({
      where: { meetingId, actedByUserId: userId },
    });

    if (actionState) {
      actionState.state = dto.state;
      actionState.taskId = dto.taskId ?? null;
      actionState.note = dto.note ?? null;
      actionState.actedAt = new Date();
      actionState.updatedBy = userId.toString();
    } else {
      actionState = this.actionStateRepo.create({
        meetingId,
        actedByUserId: userId,
        state: dto.state,
        taskId: dto.taskId ?? null,
        note: dto.note ?? null,
        actedAt: new Date(),
        createdBy: userId.toString(),
        updatedBy: userId.toString(),
      });
    }

    return this.actionStateRepo.save(actionState);
  }

  // ─── State helpers ────────────────────────────────────────────────────────

  private buildState(provider: MeetingProvider, userId: number): string {
    const payload = JSON.stringify({ provider, userId, nonce: crypto.randomUUID() });
    return Buffer.from(payload).toString('base64url');
  }

  private parseState(
    state: string,
    expectedProvider: MeetingProvider,
  ): { userId: number; provider: MeetingProvider } {
    try {
      const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      if (payload.provider !== expectedProvider) {
        throw new BadRequestException('State provider mismatch');
      }
      return { userId: payload.userId, provider: payload.provider };
    } catch {
      throw new BadRequestException('Invalid OAuth state parameter');
    }
  }

  // ─── Create Internal Meeting ──────────────────────────────────────────────

  async createInternalMeeting(
    organizerId: number,
    dto: CreateInternalMeetingDto,
  ): Promise<Meeting> {
    const startTime = new Date(dto.startTime);
    const endTime = dto.endTime ? new Date(dto.endTime) : null;
    const durationMinutes = endTime
      ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
      : null;

    // Shared externalId so all fanout rows reference the same logical meeting
    const externalId = `internal_${organizerId}_${Date.now()}`;

    // Fetch attendee user info upfront
    let userMap = new Map<number, any>();
    const allUserIds = [organizerId, ...(dto.attendeeUserIds ?? [])];
    const users = await this.meetingRepo.manager.query(
      `SELECT id, email, first_name, last_name FROM "user" WHERE id = ANY($1)`,
      [allUserIds],
    );
    users.forEach((u: any) => userMap.set(u.id, u));

    const organizerUser = userMap.get(organizerId) as any;

    const baseData = {
      provider: MeetingProvider.INTERNAL,
      externalId,
      organizerId,
      title: dto.title,
      startTime,
      endTime,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      durationMinutes,
      status: MeetingStatus.SCHEDULED,
      joinUrl: dto.location ?? null, // treat location as joinUrl if it's a link
      organizerEmail: organizerUser?.email ?? null,
      syncedAt: new Date(),
      createdBy: organizerId.toString(),
      updatedBy: organizerId.toString(),
    };

    // ── Organizer row (ownerUserId = organizerId) ────────────────────────────
    const organizerMeeting = await this.meetingRepo.save(
      this.meetingRepo.create({ ...baseData, ownerUserId: organizerId }),
    );

    // Save all attendees on the organizer's row
    const attendeeRecords: any[] = [];
    if (dto.attendeeUserIds?.length) {
      for (const uid of dto.attendeeUserIds) {
        const u = userMap.get(uid) as any;
        attendeeRecords.push(this.attendeeRepo.create({
          meetingId: organizerMeeting.id!,
          userId: uid,
          email: u?.email ?? '',
          name: u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : null,
          responseStatus: 'accepted',
          createdBy: organizerId.toString(),
          updatedBy: organizerId.toString(),
        }));
      }
      await this.attendeeRepo.save(attendeeRecords);
    }

    // ── Fanout: one row per attendee so it appears in their own meeting lists ─
    if (dto.attendeeUserIds?.length) {
      for (const attendeeUserId of dto.attendeeUserIds) {
        const u = userMap.get(attendeeUserId) as any;
        const fanoutMeeting = await this.meetingRepo.save(
          this.meetingRepo.create({ ...baseData, ownerUserId: attendeeUserId }),
        );
        // Add organizer as attendee on each fanout row
        await this.attendeeRepo.save(
          this.attendeeRepo.create({
            meetingId: fanoutMeeting.id!,
            userId: organizerId,
            email: organizerUser?.email ?? '',
            name: organizerUser
              ? `${organizerUser.first_name ?? ''} ${organizerUser.last_name ?? ''}`.trim()
              : null,
            responseStatus: 'accepted',
            createdBy: organizerId.toString(),
            updatedBy: organizerId.toString(),
          }),
        );
        // Also add the other attendees
        const otherAttendees = dto.attendeeUserIds
          .filter((id) => id !== attendeeUserId)
          .map((uid) => {
            const ou = userMap.get(uid) as any;
            return this.attendeeRepo.create({
              meetingId: fanoutMeeting.id!,
              userId: uid,
              email: ou?.email ?? '',
              name: ou ? `${ou.first_name ?? ''} ${ou.last_name ?? ''}`.trim() : null,
              responseStatus: 'accepted',
              createdBy: organizerId.toString(),
              updatedBy: organizerId.toString(),
            });
          });
        if (otherAttendees.length) await this.attendeeRepo.save(otherAttendees);
      }
    }

    // Return the organizer's row with attendees
    return this.meetingRepo.findOne({
      where: { id: organizerMeeting.id },
      relations: ['attendees'],
    }) as Promise<Meeting>;
  }

  // ─── Internal Meeting: Edit / Delete ──────────────────────────────────────

  /**
   * Loads an internal meeting by id and asserts the caller may still change it:
   * it must be internal, owned by the caller, and not yet started.
   *
   * Internal meetings are fanned out into one row per participant, all sharing
   * the same externalId, so the caller may be holding the id of any of those
   * rows — the organizer check is on organizerId, not ownerUserId.
   *
   * @param action verb used in the "already started" message ('edited' | 'deleted')
   */
  private async loadOwnInternalMeeting(
    meetingId: number,
    userId: number,
    action: 'edited' | 'deleted',
  ): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException(`Meeting #${meetingId} not found`);

    if (meeting.provider !== MeetingProvider.INTERNAL) {
      throw new BadRequestException(
        'Only internal meetings can be edited or deleted. Meetings synced from ' +
          'Teams, Google, Zoom or Slack must be changed in that provider.',
      );
    }
    if (meeting.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can change this meeting');
    }

    // Only upcoming meetings can be changed. Internal meetings compute their
    // status from the clock rather than storing it, so derive it here instead
    // of trusting the persisted `status` column.
    const now = new Date();
    if (meeting.scheduledStartTime && now >= meeting.scheduledStartTime) {
      const hasEnded =
        meeting.scheduledEndTime != null && now > meeting.scheduledEndTime;
      throw new BadRequestException(
        hasEnded
          ? `This meeting has already ended and can no longer be ${action}`
          : `This meeting is already in progress and can no longer be ${action}.`,
      );
    }

    return meeting;
  }

  /**
   * Updates an internal meeting across every fanout row.
   *
   * Attendees are a full replacement: rows for people no longer invited are
   * removed and rows for newly invited people are created, so the fanout stays
   * consistent with the new attendee list.
   */
  async updateInternalMeeting(
    meetingId: number,
    userId: number,
    dto: UpdateInternalMeetingDto,
  ): Promise<Meeting> {
    const meeting = await this.loadOwnInternalMeeting(meetingId, userId, 'edited');
    const { externalId } = meeting;
    const organizerId = userId;

    const startTime = new Date(dto.startTime);
    const endTime = dto.endTime ? new Date(dto.endTime) : null;
    const durationMinutes = endTime
      ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
      : null;

    const attendeeUserIds = (dto.attendeeUserIds ?? []).filter(
      (id) => id !== organizerId,
    );

    // Everyone who needs a row after this edit: organizer + current attendees
    const allUserIds = [organizerId, ...attendeeUserIds];
    const users = await this.meetingRepo.manager.query(
      `SELECT id, email, first_name, last_name FROM "user" WHERE id = ANY($1)`,
      [allUserIds],
    );
    const userMap = new Map<number, any>();
    users.forEach((u: any) => userMap.set(u.id, u));
    const organizerUser = userMap.get(organizerId) as any;

    const nameOf = (u: any) =>
      u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : null;

    const sharedData = {
      title: dto.title,
      startTime,
      endTime,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      durationMinutes,
      joinUrl: dto.location ?? null,
      updatedBy: organizerId.toString(),
    };

    await this.dataSource.transaction(async (manager) => {
      const meetingRepo = manager.getRepository(Meeting);
      const attendeeRepo = manager.getRepository(MeetingAttendee);

      const existingRows = await meetingRepo.find({ where: { externalId } });
      const rowByOwner = new Map(existingRows.map((r) => [r.ownerUserId, r]));

      // Rows whose owner is no longer part of the meeting
      const staleRows = existingRows.filter(
        (r) => !allUserIds.includes(r.ownerUserId),
      );
      if (staleRows.length) {
        await attendeeRepo.delete({
          meetingId: In(staleRows.map((r) => r.id!)),
        });
        await meetingRepo.remove(staleRows);
      }

      // Update or create one row per current participant
      for (const ownerUserId of allUserIds) {
        const existing = rowByOwner.get(ownerUserId);
        const row = existing
          ? meetingRepo.merge(existing, sharedData)
          : meetingRepo.create({
              ...sharedData,
              provider: MeetingProvider.INTERNAL,
              externalId,
              ownerUserId,
              organizerId,
              status: MeetingStatus.SCHEDULED,
              organizerEmail: organizerUser?.email ?? null,
              syncedAt: new Date(),
              createdBy: organizerId.toString(),
            });
        const saved = await meetingRepo.save(row);

        // Rebuild this row's attendee list: everyone in the meeting except the
        // row's own owner.
        await attendeeRepo.delete({ meetingId: saved.id! });
        const others = allUserIds.filter((id) => id !== ownerUserId);
        if (others.length) {
          await attendeeRepo.save(
            others.map((uid) => {
              const u = userMap.get(uid) as any;
              return attendeeRepo.create({
                meetingId: saved.id!,
                userId: uid,
                email: u?.email ?? '',
                name: nameOf(u),
                responseStatus: 'accepted',
                createdBy: organizerId.toString(),
                updatedBy: organizerId.toString(),
              });
            }),
          );
        }
      }
    });

    // Return the organizer's row with its refreshed attendees
    return this.meetingRepo.findOne({
      where: { externalId, ownerUserId: organizerId },
      relations: ['attendees'],
    }) as Promise<Meeting>;
  }

  /**
   * Deletes an internal meeting for every participant, along with its
   * attendee and action-state rows. Only possible while it is still upcoming.
   */
  async deleteInternalMeeting(
    meetingId: number,
    userId: number,
  ): Promise<{ success: boolean; deleted: number }> {
    const meeting = await this.loadOwnInternalMeeting(meetingId, userId, 'deleted');
    const { externalId } = meeting;

    const deleted = await this.dataSource.transaction(async (manager) => {
      const meetingRepo = manager.getRepository(Meeting);
      const attendeeRepo = manager.getRepository(MeetingAttendee);
      const actionStateRepo = manager.getRepository(MeetingActionState);

      const rows = await meetingRepo.find({ where: { externalId } });
      if (!rows.length) return 0;

      const ids = rows.map((r) => r.id!);
      await attendeeRepo.delete({ meetingId: In(ids) });
      await actionStateRepo.delete({ meetingId: In(ids) });
      await meetingRepo.remove(rows);
      return ids.length;
    });

    return { success: true, deleted };
  }
}
