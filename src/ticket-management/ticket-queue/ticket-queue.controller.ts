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
import { TicketQueueService } from './ticket-queue.service';
import {
  CreateTicketQueueDto,
  ResponseTicketQueueDto,
  UpdateTicketQueueDto,
} from './dto/ticket-queue.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

@Controller('ticket-queue')
export class TicketQueueController {
  constructor(
    private readonly ticketQueueService: TicketQueueService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('100')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search('ticket_queue', item);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Post()
  createTicketQueue(
    @Body() createTicketQueueDto: CreateTicketQueueDto,
    @Request() req,
  ) {
    return this.ticketQueueService.createTicketQueue(
      createTicketQueueDto,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Put(':id')
  updateTicketQueue(
    @Param('id') id: number,
    @Body() updateTicketQueueDto: UpdateTicketQueueDto,
    @Request() req,
  ) {
    return this.ticketQueueService.updateTicketQueue(
      id,
      updateTicketQueueDto,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('100')
  @Get()
  getAllTicketQueues(): Promise<ResponseTicketQueueDto[]> {
    return this.ticketQueueService.getAllTicketQueues();
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Delete(':id')
  deleteTicketQueue(@Param('id') id: number): Promise<{ message: string }> {
    return this.ticketQueueService.deleteTicketQueue(id);
  }
}
