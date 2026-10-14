import { Body, Controller, Post, UseGuards, Res, Req, Headers } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../authorization/decorator/authorization.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async handleChat(
    @Body('message') message: string,
    @Body('conversationId') conversationId: string,
    @Req() req: any,
    @Headers('x-selected-company') selectedCompanyHeader: string,
    @Res() res: Response,
  ) {
    const user = req.user;
    const companyId = Number(selectedCompanyHeader || req.activeCompany?.companyId || 0);

    const stream = await this.chatService.processChat(message, conversationId, user, companyId);
    
    // Set proper headers to ensure the browser and Express don't buffer the stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    stream.pipe(res);
  }
}
