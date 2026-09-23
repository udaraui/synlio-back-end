import {
  Controller,
  Get,
  Delete,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Redirect,
  Request,
  UseGuards,
  BadRequestException,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../authorization/decorator/authorization-permissions.decorator';
import { MeetingsIntegrationService } from './meetings-integration.service';
import { MeetingProvider } from './entities/meeting-integration-connection.entity';
import { ConfigService } from '@nestjs/config';
import { UpdateMeetingActualTimesDto } from './dto/update-meeting-actual-times.dto';
import { UpdateMeetingActualDurationDto } from './dto/update-meeting-actual-duration.dto';
import { SetMeetingActionStateDto } from './dto/set-meeting-action-state.dto';
import { CreateInternalMeetingDto } from './dto/create-internal-meeting.dto';
import { UpdateInternalMeetingDto } from './dto/update-internal-meeting.dto';

const VALID_PROVIDERS = Object.values(MeetingProvider) as string[];

function parseProvider(p: string): MeetingProvider {
  if (!VALID_PROVIDERS.includes(p)) {
    throw new BadRequestException(
      `Invalid provider "${p}". Must be one of: ${VALID_PROVIDERS.join(', ')}`,
    );
  }
  return p as MeetingProvider;
}

@Controller('meetings-integration')
export class MeetingsIntegrationController {
  private readonly logger = new Logger(MeetingsIntegrationController.name);

  constructor(
    private readonly service: MeetingsIntegrationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /meetings-integration/auth-url/:provider
   * Returns the OAuth redirect URL for a given provider.
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109')
  @Get('auth-url/:provider')
  getAuthUrl(
    @Param('provider') providerParam: string,
    @Request() req: any,
  ): { url: string } {
    const provider = parseProvider(providerParam);
    const userId: number = req.user?.userId ?? req.user?.id;
    const url = this.service.getAuthUrl(provider, userId);
    return { url };
  }

  /**
   * GET /meetings-integration/callback/:provider
   * OAuth callback endpoint registered with each provider.
   */
  @Get('callback/:provider')
  @Redirect()
  async handleCallback(
    @Param('provider') providerParam: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ): Promise<{ url: string }> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const meetingsUrl = `${frontendUrl}/meetings`;

    if (error) {
      this.logger.warn(`OAuth error from ${providerParam}: ${error}`);
      return {
        url: `${meetingsUrl}?error=${encodeURIComponent(error)}&provider=${providerParam}`,
      };
    }

    if (!code || !state) {
      return {
        url: `${meetingsUrl}?error=missing_params&provider=${providerParam}`,
      };
    }

    try {
      const provider = parseProvider(providerParam);
      await this.service.handleCallback(provider, code, state);
      return { url: `${meetingsUrl}?connected=${providerParam}` };
    } catch (err) {
      this.logger.error(
        `Callback handling failed for ${providerParam}`,
        err?.message,
      );
      return {
        url: `${meetingsUrl}?error=${encodeURIComponent(err?.message ?? 'callback_failed')}&provider=${providerParam}`,
      };
    }
  }

  /**
   * DELETE /meetings-integration/disconnect/:provider
   * Revokes the connection for a given provider.
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109')
  @Delete('disconnect/:provider')
  async disconnect(
    @Param('provider') providerParam: string,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    const provider = parseProvider(providerParam);
    const userId: number = req.user?.userId ?? req.user?.id;
    await this.service.disconnect(provider, userId);
    return { success: true };
  }

  /**
   * GET /meetings-integration/status
   * Returns connection status for all providers for the current user.
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109', '54', '101')
  @Get('status')
  async getStatus(@Request() req: any) {
    const userId: number = req.user?.userId ?? req.user?.id;
    return this.service.getConnectionStatus(userId);
  }

  /**
   * POST /meetings-integration/sync
   * Manually triggers a meetings sync for one or all connected providers.
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109')
  @Post('sync')
  async sync(
    @Request() req: any,
    @Query('provider') providerParam?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    const provider = providerParam ? parseProvider(providerParam) : undefined;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.service.syncMeetings(
      userId,
      provider,
      start,
      end,
      userId.toString(),
    );
  }

  /**
   * GET /meetings-integration/meetings/stats
   * Returns aggregated meeting stats for the Pulse StatCards.
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109', '54', '101')
  @Get('meetings/stats')
  async getMeetingStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    return this.service.getMeetingStats(userId, startDate, endDate);
  }

  /**
   * GET /meetings-integration/meetings
   * Returns paginated list of meetings for the current user.
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109', '54', '101')
  @Get('meetings')
  async getMeetings(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('provider') providerParam?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeIgnored') includeIgnored?: string,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    const provider = providerParam ? parseProvider(providerParam) : undefined;
    return this.service.getMeetings(userId, {
      startDate,
      endDate,
      provider,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      includeIgnored: includeIgnored === 'true',
    });
  }

  /**
   * PATCH /meetings-integration/meetings/:id/actual-times
   * Updates the actual start/end times for a meeting.
   * Scheduled times remain unchanged.
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109', '54', '101')
  @Patch('meetings/:id/actual-times')
  async updateActualTimes(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: UpdateMeetingActualTimesDto,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    return this.service.updateMeetingActualTimes(id, userId, dto);
  }

  /**
   * PATCH /meetings-integration/meetings/:id/action-state
   * Sets the workflow action state for a meeting (none, ignored, linked_to_task).
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109')
  @Patch('meetings/:id/action-state')
  async setActionState(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: SetMeetingActionStateDto,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    return this.service.setMeetingActionState(id, userId, dto);
  }
  /**
   * PATCH /meetings-integration/meetings/:id/actual-duration
   * Updates the actual duration (in minutes) for a meeting.
   * Pass 0 to clear the actual duration (reverts to scheduled).
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109')
  @Patch('meetings/:id/actual-duration')
  async updateActualDuration(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: UpdateMeetingActualDurationDto,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    return this.service.updateMeetingActualDuration(id, userId, dto);
  }

  /**
   * POST /meetings-integration/internal
   * Creates a new internal meeting and fans it out to all selected attendees.
   */
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('109')
  @Post('internal')
  async createInternalMeeting(
    @Request() req: any,
    @Body() dto: CreateInternalMeetingDto,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    return this.service.createInternalMeeting(userId, dto);
  }

  /**
   * PATCH /meetings-integration/internal/:id
   * Updates a manually created internal meeting across all of its attendee rows.
   * Only the organizer may do this; provider-synced meetings are rejected.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('internal/:id')
  async updateInternalMeeting(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: UpdateInternalMeetingDto,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    return this.service.updateInternalMeeting(id, userId, dto);
  }

  /**
   * DELETE /meetings-integration/internal/:id
   * Deletes a manually created internal meeting for every participant.
   * Only the organizer may do this; provider-synced meetings are rejected.
   */
  @UseGuards(JwtAuthGuard)
  @Delete('internal/:id')
  async deleteInternalMeeting(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId: number = req.user?.userId ?? req.user?.id;
    return this.service.deleteInternalMeeting(id, userId);
  }
}
