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
import { TicketImpactService } from './ticket-impact.service';
import {
  CreateTicketImpactDto,
  ResponseTicketImpactDto,
  UpdateTicketImpactDto,
} from './dto/ticket-impact.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

@Controller('ticket-impact')
export class TicketImpactController {
  constructor(
    private readonly ticketImpactService: TicketImpactService,
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('100')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    return this.commonDbOperationService.search('ticket_impact', item);
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Post()
  createTicketImpact(
    @Body() createTicketImpactDto: CreateTicketImpactDto,
    @Request() req,
  ) {
    return this.ticketImpactService.createTicketImpact(
      createTicketImpactDto,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Put(':id')
  updateTicketImpact(
    @Param('id') id: number,
    @Body() updateTicketImpactDto: UpdateTicketImpactDto,
    @Request() req,
  ) {
    return this.ticketImpactService.updateTicketImpact(
      id,
      updateTicketImpactDto,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('100')
  @Get()
  getAllTicketImpacts(): Promise<ResponseTicketImpactDto[]> {
    return this.ticketImpactService.getAllTicketImpacts();
  }

  @UseGuards(JwtAuthGuard)
  @AuthorizationPermissions('97', '98')
  @Delete(':id')
  deleteTicketImpact(@Param('id') id: number): Promise<{ message: string }> {
    return this.ticketImpactService.deleteTicketImpact(id);
  }
}
