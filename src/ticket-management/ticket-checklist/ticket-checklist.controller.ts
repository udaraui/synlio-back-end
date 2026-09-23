import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { ChecklistService } from '../../common/checklist/checklist.service';
import type { UpdateChecklistDto } from '../../common/checklist/checklist.dto';

/** Ticket-side entry point onto the shared checklist table. */
@Controller('ticket-management/ticket-checklist')
export class TicketChecklistController {
  constructor(private readonly service: ChecklistService) {}

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('103')
  @Post()
  create(
    @Body()
    dto: {
      name: string;
      ticketId: number;
      isChecked?: boolean;
      assigneeId?: number | null;
    },
    @Request() req: any,
  ) {
    return this.service.create(
      {
        name: dto.name,
        entityType: 'Ticket',
        entityId: dto.ticketId,
        isChecked: dto.isChecked,
        assigneeId: dto.assigneeId,
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('103')
  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateChecklistDto,
    @Request() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.update(+id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('101')
  @Get('ticket/:ticketId')
  findByTicket(@Param('ticketId') ticketId: number) {
    return this.service.findByEntity('Ticket', +ticketId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @AuthorizationPermissions('104')
  @Delete(':id')
  delete(@Param('id') id: number, @Request() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.delete(+id, req.user);
  }
}
