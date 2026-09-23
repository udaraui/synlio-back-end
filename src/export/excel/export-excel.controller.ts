import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { ExportExcelService } from './export-excel.service';

@Controller('export/excel')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class ExportExcelController {
  constructor(private readonly exportExcelService: ExportExcelService) {}

  /**
   * POST /export/excel/task
   *
   * Accepts the same QueryParam body that the task /search endpoint uses.
   * Returns a downloadable .xlsx file with all matching task rows (up to EXPORT_ROW_LIMIT).
   * Requires privilege 123 (export:excel-tasks).
   */
  @AuthorizationPermissions('112')
  @Post('task')
  async exportTasks(
    @Body() item: QueryParam,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const activeCompanyId = req.activeCompany?.companyId;

    const filters = [...(item.filters ?? [])];
    if (activeCompanyId && activeCompanyId !== 0) {
      filters.push({
        field: 'companyId',
        matchMode: 'equals',
        value: activeCompanyId,
      });
    }

    await this.exportExcelService.exportTasks(
      filters,
      item.multiSorts ?? [],
      res,
    );
  }

  /**
   * POST /export/excel/ticket
   *
   * Accepts the same QueryParam body that the ticket /search endpoint uses.
   * Returns a downloadable .xlsx file with all matching ticket rows (up to EXPORT_ROW_LIMIT).
   * Requires privilege 124 (export:excel-tickets).
   */
  @AuthorizationPermissions('113')
  @Post('ticket')
  async exportTickets(
    @Body() item: QueryParam,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const activeCompanyId = req.activeCompany?.companyId;

    const filters = [...(item.filters ?? [])];
    if (activeCompanyId && activeCompanyId !== 0) {
      filters.push({
        field: 'companyId',
        matchMode: 'equals',
        value: activeCompanyId,
      });
    }

    await this.exportExcelService.exportTickets(
      filters,
      item.multiSorts ?? [],
      res,
    );
  }

  @Get('template/user')
  async downloadUserTemplate(@Res() res: Response): Promise<void> {
    await this.exportExcelService.downloadUserTemplate(res);
  }

  @Get('template/resource')
  async downloadResourceTemplate(@Res() res: Response): Promise<void> {
    await this.exportExcelService.downloadResourceTemplate(res);
  }

  @Get('template/ticket')
  async downloadTicketTemplate(@Res() res: Response): Promise<void> {
    await this.exportExcelService.downloadTicketTemplate(res);
  }
}
