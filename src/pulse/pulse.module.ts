import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PulseController } from './pulse.controller';
import { PulseService } from './pulse.service';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AlertModule } from '../alert/alert.module';
import { Activity } from './entities/activity.entity';

@Module({
  imports: [AuthorizationModule, AlertModule, TypeOrmModule.forFeature([Activity])],
  controllers: [PulseController],
  providers: [PulseService],
  exports: [PulseService],
})
export class PulseModule {}
