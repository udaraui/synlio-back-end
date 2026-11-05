import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { TicketEntityResolverService } from './resolver/ticket-entity-resolver.service';
import { TicketMutationExecutorService } from './executor/ticket-mutation-executor.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { AiAuditLog } from './ai-audit-log/ai-audit-log.entity';
import { TicketManagementModule } from '../ticket-management/ticket-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiAuditLog]),
    AuthorizationModule,
    AuthModule,
    RedisModule,
    forwardRef(() => TicketManagementModule),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    TicketEntityResolverService,
    TicketMutationExecutorService,
  ],
  exports: [
    AiService,
    TicketEntityResolverService,
    TicketMutationExecutorService,
  ],
})
export class AiModule { }

