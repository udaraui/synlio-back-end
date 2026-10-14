import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [AuthorizationModule, AuthModule, RedisModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
