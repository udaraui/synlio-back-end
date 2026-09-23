import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';
import { RedisController } from './redis.controller';

@Global()
@Module({
  controllers: [RedisController],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          db: 0,
          password: process.env.REDIS_PASSWORD || '',
          tls: process.env.NODE_ENV === 'production' ? {} : undefined,
          keyPrefix: 'synlio:',
          // Connection optimization
          keepAlive: 10000,
          maxRetriesPerRequest: 3,
        });
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule { }
