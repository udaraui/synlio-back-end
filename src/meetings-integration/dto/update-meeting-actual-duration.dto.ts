import { IsInt, Min, Max } from 'class-validator';

export class UpdateMeetingActualDurationDto {
  /**
   * Actual duration in minutes (0–1440 = up to 24 hours).
   * If 0 is provided the actual duration is cleared.
   */
  @IsInt()
  @Min(0)
  @Max(1440)
  actualDurationMinutes: number;
}
