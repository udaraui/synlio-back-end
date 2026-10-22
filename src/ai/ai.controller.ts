import { Body, Controller, Post, UseGuards, Res, Req, Headers, HttpStatus, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../authorization/decorator/authorization-permissions.decorator';
import { Public } from '../auth/public.decorator';
import { ServiceBusService } from '../common/azure/service-bus.service';
import { AiAuditPayloadDto } from './dto/ai-audit-payload.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly serviceBusService: ServiceBusService,
  ) {}

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
  ) {
    const user = req.user;
    const companyId = Number(selectedCompanyHeader || req.activeCompany?.companyId || 0);

    const stream = await this.aiService.processChat(message, conversationId, user, companyId, agent, context, chatMode, history);
    
    // Set proper headers to ensure the browser and Express don't buffer the stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    stream.pipe(res);
  }

  @Public()
  @Post('internal/audit-telemetry')
  @HttpCode(HttpStatus.ACCEPTED)
  async recordAuditTelemetry(@Body() payload: AiAuditPayloadDto) {
    await this.serviceBusService.sendAiAuditJob(payload);
    return { status: 'enqueued', requestId: payload?.requestId };
  }
}
