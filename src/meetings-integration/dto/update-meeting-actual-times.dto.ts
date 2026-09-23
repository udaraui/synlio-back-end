import { IsDateString, IsNotEmpty } from 'class-validator';

export class UpdateMeetingActualTimesDto {
  @IsDateString()
  @IsNotEmpty()
  actualStartTime: string;

  @IsDateString()
  @IsNotEmpty()
  actualEndTime: string;
}
