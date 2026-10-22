import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { AiAuditLog } from './ai-audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiAuditLog]),
    AuthorizationModule,
    AuthModule,
    RedisModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule { }
