import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonDbOperationService } from './common-db-operation/common-db-operation.service';
import { WebPubSubService } from './azure/web-pubsub.service';
import { ServiceBusService } from './azure/service-bus.service';
import { PostSequenceService } from './sequence/post-sequence.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CommonDbOperationService, WebPubSubService, ServiceBusService, PostSequenceService],
  exports: [CommonDbOperationService, WebPubSubService, ServiceBusService, PostSequenceService],
})
export class CommonModule {}
