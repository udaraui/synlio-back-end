import { IsEnum, IsOptional, IsInt } from 'class-validator';
import { MeetingActionStateEnum } from '../entities/meeting-action-state.entity';

export class SetMeetingActionStateDto {
  @IsEnum(MeetingActionStateEnum)
  state: MeetingActionStateEnum;

  @IsOptional()
  @IsInt()
  taskId?: number;

  @IsOptional()
  note?: string;
}
