import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PulseController } from './pulse.controller';
import { PulseService } from './pulse.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AlertModule } from '../alert/alert.module';
import { NewActivity } from './entities/new-activity.entity';

@Module({
  imports: [AuthorizationModule, AlertModule, TypeOrmModule.forFeature([NewActivity])],
  controllers: [PulseController],
  providers: [PulseService],
  exports: [PulseService],
})
export class PulseModule {}
