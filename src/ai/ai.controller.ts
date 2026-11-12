import { Body, Controller, Post, UseGuards, Res, Req, Headers, HttpStatus, HttpCode, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../authorization/decorator/authorization-permissions.decorator';
import { Public } from '../auth/public.decorator';
import { ServiceBusService } from '../common/azure/service-bus.service';
import { AiAuditPayloadDto } from './ai-audit-log/ai-audit-payload.dto';
import { TicketMutationExecutorService } from './executor/ticket-mutation-executor.service';

@Controller('chat')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly serviceBusService: ServiceBusService,
    private readonly mutationExecutorService: TicketMutationExecutorService,
  ) { }

  @Post()
  @AuthorizationPermissions('120')
  async handleChat(
    @Body('message') message: string,
    @Body('conversationId') conversationId: string,
    @Req() req: any,
    @Headers('x-selected-company') selectedCompanyHeader: string,
    @Res() res: Response,
    @Body('agent') agent?: string,
    @Body('context') context?: any,
    @Body('chatMode') chatMode?: string,
    @Body('history') history?: Array<{ role: string; content: string }>,
    @Body('pendingDraft') pendingDraft?: any,
    @Body('attachments') attachments?: any,
  ) {
    const user = req.user;
    const companyId = Number(selectedCompanyHeader || req.activeCompany?.companyId || 0);

    const stream = await this.aiService.processChat(message, conversationId, user, companyId, agent, context, chatMode, history, pendingDraft, attachments);

    // Set proper headers to ensure the browser and Express don't buffer the stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    req.on('close', () => {
      if (!res.writableEnded) {
        this.aiService.stopChat(conversationId);
      }
    });

    stream.pipe(res);
  }

  @Post('stop')
  @AuthorizationPermissions('120')
  @HttpCode(HttpStatus.OK)
  async stopChat(
    @Body('conversationId') conversationId: string,
  ) {
    return await this.aiService.stopChat(conversationId);
  }

  @Public()
  @Post('internal/audit-telemetry')
  @HttpCode(HttpStatus.ACCEPTED)
  async recordAuditTelemetry(@Body() payload: AiAuditPayloadDto) {
    // Non-blocking dispatch to Azure Service Bus so AI service receives instant 202 response
    this.serviceBusService.sendAiAuditJob(payload).catch((err) => {
      this.logger.error(
        `Failed to enqueue AI audit job for requestId: ${payload?.requestId}`,
        err instanceof Error ? err.stack : String(err),
      );
    });
    return { status: 'enqueued', requestId: payload?.requestId };
  }
  @Post('mutate')
  @AuthorizationPermissions('120')
  async executeMutation(
    @Body() payload: any,
    @Req() req: any,
    @Headers('x-selected-company') selectedCompanyHeader: string,
  ) {
    const user = req.user;
    const companyId = Number(selectedCompanyHeader || req.activeCompany?.companyId || 0);
    const allowedTicketSpaceIds = user?.ticketSpaces || [];

    return await this.mutationExecutorService.executeTicketMutation(
      payload,
      companyId,
      allowedTicketSpaceIds,
      user,
    );
  }
}
