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
import { TicketTypeService } from './ticket-type.service';
import {
  CreateTicketTypeDto,
  ResponseTicketTypeDto,
  UpdateTicketTypeDto,
} from './dto/ticket-type.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
@Controller('ticket-type')
export class TicketTypeController {
  constructor(
    private readonly ticketTypeService: TicketTypeService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}
  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('100')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search('ticket_type', item);
  }
  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Post()
  createTicketType(
    @Body() createTicketTypeDto: CreateTicketTypeDto,
    @Request() req,
  ) {
    return this.ticketTypeService.createTicketType(
      createTicketTypeDto,
      req.user,
    );
  }
  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Put(':id')
  updateTicketType(
    @Param('id') id: number,
    @Body() updateTicketTypeDto: UpdateTicketTypeDto,
    @Request() req,
  ) {
    return this.ticketTypeService.updateTicketType(
      id,
      updateTicketTypeDto,
      req.user,
    );
  }
  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('100')
  @Get()
  getAllTicketTypes(): Promise<ResponseTicketTypeDto[]> {
    return this.ticketTypeService.getAllTicketTypes();
  }
  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Delete(':id')
  deleteTicketType(@Param('id') id: number): Promise<{ message: string }> {
    return this.ticketTypeService.deleteTicketType(id);
  }
}
