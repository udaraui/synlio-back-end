import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
  ParseIntPipe,
  Headers,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /** GET /notification/user  — returns paginated notifications for the logged-in user */
  @UseGuards(JwtAuthGuard)
  @Get('user')
  getMyNotifications(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-selected-company') companyIdStr?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId as number;
    const companyId = companyIdStr && companyIdStr !== 'null' ? parseInt(companyIdStr, 10) : undefined;
    return this.notificationService.findByUser(
      userId,
      companyId,
      limit ? parseInt(limit, 10) : 5,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /** GET /notification/unread-count  — lightweight badge count for the logged-in user */
  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  getUnreadCount(
    @Request() req: any,
    @Headers('x-selected-company') companyIdStr?: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId as number;
    const companyId = companyIdStr && companyIdStr !== 'null' ? parseInt(companyIdStr, 10) : undefined;
    return this.notificationService.getUnreadCount(userId, companyId);
  }

  /** PATCH /notification/mark-all-read  — mark every unread notification as read */
  @UseGuards(JwtAuthGuard)
  @Patch('mark-all-read')
  markAllAsRead(@Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId as number;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.notificationService.markAllAsRead(userId, req.user);
  }

  /** PATCH /notification/:id/mark-read  — mark a single notification as read */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/mark-read')
  markAsRead(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.notificationService.markAsRead(id, req.user);
  }
}
