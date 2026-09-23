import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards, Request } from '@nestjs/common';
import { TicketTemplateService } from './ticket-template.service';
import { CreateTicketTemplateDto, UpdateTicketTemplateDto } from './dto/ticket-template.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';

@Controller('ticket-templates')
@UseGuards(JwtAuthGuard)
export class TicketTemplateController {
  constructor(
    private readonly ticketTemplateService: TicketTemplateService,
  ) { }

  @Post()
  async create(@Body() createTicketTemplateDto: CreateTicketTemplateDto, @Request() req: any) {
    const companyId = req.activeCompany?.companyId || parseInt(req.headers['x-selected-company'] as string, 10) || null;
    return await this.ticketTemplateService.create(createTicketTemplateDto, req.user.email, companyId);
  }

  @Post('search')
  async search(
    @Body() item: QueryParam,
    @Request() req: any,
  ) {
    const filters = item.filters || [];
    
    // Extract spaceId
    const spaceIdFilter = filters.find(f => f.field === 'ticketSpaceId');
    const spaceId = spaceIdFilter ? Number(spaceIdFilter.value) : null;

    // Extract name
    const nameFilterObj = filters.find(f => f.field === 'name');
    const nameFilter = nameFilterObj ? String(nameFilterObj.value) : null;

    // Extract active company
    const parsedHeaderCompany = req.headers['x-selected-company'] ? parseInt(req.headers['x-selected-company'] as string, 10) : null;
    const activeCompanyId = req.activeCompany?.companyId && req.activeCompany.companyId !== 0 
      ? Number(req.activeCompany.companyId) 
      : (parsedHeaderCompany !== 0 ? parsedHeaderCompany : null);

    // User email for permissions
    const userEmail = req.user.email;

    // Pagination
    const first = item.first ? Number(item.first) : 0;
    const rows = item.rows ? Number(item.rows) : 100;

    return await this.ticketTemplateService.search(
      spaceId,
      activeCompanyId,
      userEmail,
      nameFilter,
      first,
      rows
    );
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTicketTemplateDto: UpdateTicketTemplateDto,
    @Request() req
  ) {
    return await this.ticketTemplateService.update(id, updateTicketTemplateDto, req.user.email);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return await this.ticketTemplateService.remove(id, req.user.email);
  }
}
