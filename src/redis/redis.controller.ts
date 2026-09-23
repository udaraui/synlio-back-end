import { Controller, Get } from '@nestjs/common';
import { RedisService } from './redis.service';

@Controller('redis')
export class RedisController {
  constructor(private redisService: RedisService) {}

  @Get()
  async getRedis() {
    return this.redisService.get('UCP_2_2');
  }
}
