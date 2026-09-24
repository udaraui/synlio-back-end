import { Body, Controller, Post, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../authorization/decorator/authorization.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async handleChat(@Body('message') message: string, @Res() res: Response) {
    const stream = await this.chatService.processChat(message);
    stream.pipe(res);
  }
}
