import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateCalendarDto, UpdateCalendarDto } from './dto/calendar.dto';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.gurard';
import { AuthorizationPermissions } from '../../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../../common/common-db-operation/common-db-operation-query-param.dto';
import { AuthorizationGuard } from 'src/authorization/decorator/authorization.guard';

@Controller('calendar')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class CalendarController {
  constructor(
    private readonly commonDbOperationService: CommonDbOperationService,
    private readonly calendarService: CalendarService,
  ) {}

  @AuthorizationPermissions('29')
  @Post('/search')
  async search(
    @Body() item: QueryParam,
    @Req() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const activeCompanyId = req.activeCompany?.companyId;

    if (activeCompanyId && activeCompanyId !== 0) {
      if (!item.filters) item.filters = [];
      item.filters.push({
        field: 'companyId',
        matchMode: 'equals',
        value: activeCompanyId,
      });
    }

    return this.commonDbOperationService.search('calendar', item);
  }

  @AuthorizationPermissions('29')
  @Post('/search/calendar-dates')
  async searchCalendarDates(
    @Body() item: QueryParam,
    @Req() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const activeCompanyId = req.activeCompany?.companyId;

    // if (activeCompanyId && activeCompanyId !== 0) {
    //   if (!item.filters) item.filters = [];
    //   item.filters.push({
    //     field: 'companyId',
    //     matchMode: 'equals',
    //     value: activeCompanyId,
    //   });
    // }

    return this.commonDbOperationService.search('CalendarDays', item);
  }

  @AuthorizationPermissions('30')
  @Post()
  createCalendar(@Body() data: CreateCalendarDto, @Request() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.createCalendar(data, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('32')
  @Post('extend/:id')
  extendCalendar(
    @Param('id') id: number,
    @Body('year') year: number,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.extendCalendar(
      id,
      year,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('32')
  @Put(':id')
  updateCalendar(
    @Param('id') id: number,
    @Body() data: UpdateCalendarDto,
    @Req() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.updateCalendar(
      id,
      data,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('31')
  @Patch(':id')
  disableCalendar(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.disableCalendar(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('31')
  @Delete(':id')
  deleteCalendar(@Param('id') id: number, @Req() req: any) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.deleteCalendar(id, req.user, activeCompanyId);
  }

  @AuthorizationPermissions('33')
  @Post('special-holiday/:id')
  createSpecialHoliday(
    @Param('id') id: number,
    @Body() data: any,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.createSpecialHoliday(
      id,
      data,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('35')
  @Post('repeated-holiday/:id')
  createRepeatedHoliday(
    @Param('id') id: number,
    @Body() data: any,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.createRepeatedHoliday(
      id,
      data,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('34')
  @Post('special-working-day/:id')
  createSpecialWorkingDay(
    @Param('id') id: number,
    @Body() data: any,
    @Request() req: any,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.createSpecialWorkingDay(
      id,
      data,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('29', '38')
  @Get('getAllCalendar/:companyId')
  getAllCalendar(@Request() req: any, @Param('companyId') companyId: number) {
    const activeCompanyId = req.activeCompany?.companyId;

    // Ensure the requested company matches the active company (unless system scope)
    const effectiveCompanyId =
      activeCompanyId && activeCompanyId !== 0 ? activeCompanyId : companyId;

    return this.calendarService.getAllCalendar(effectiveCompanyId);
  }

  @AuthorizationPermissions('29')
  @Get('week-config/:id')
  getWeekConfig(@Request() req: any, @Param('id') id: number) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.getWeekConfig(id, activeCompanyId);
  }

  @AuthorizationPermissions('29')
  @Get('getAllCalendarDays/:id')
  getAllCalendarDays(@Request() req: any, @Param('id') id: number) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.getAllCalendarDays(id, activeCompanyId);
  }

  @AuthorizationPermissions('29')
  @Get('getAllSpecialHoliday/:id')
  getAllSpecialHoliday(@Request() req: any, @Param('id') id: number) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.getAllSpecialHoliday(id, activeCompanyId);
  }

  @AuthorizationPermissions('29')
  @Get('getAllRepeatedHoliday/:id')
  getAllRepeatedHoliday(
    @Request() req: any,
    @Param('id') id: number,
    @Query('year') year?: string,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    const selectedYear = year ? Number(year) : undefined;
    return this.calendarService.getAllRepeatedHoliday(
      id,
      activeCompanyId,
      selectedYear,
    );
  }

  @AuthorizationPermissions('29')
  @Get('getAllSpecialWorkingDays/:id')
  getAllSpecialWorkingDays(@Request() req: any, @Param('id') id: number) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.getAllSpecialWorkingDays(id, activeCompanyId);
  }

  @AuthorizationPermissions('36', '37')
  @Patch('deleteHolidaysAndWorkingDays/:calendarId')
  deleteHolidaysAndWorkingDays(
    @Request() req: any,
    @Param('calendarId') calendarId: number,
    @Body('id') id: number,
    @Body('type') type: string,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.deleteHolidaysAndWorkingDays(
      calendarId,
      type,
      id,
      req.user,
      activeCompanyId,
    );
  }

  @AuthorizationPermissions('36')
  @Delete('repeated-holiday/:calendarId/:day')
  deleteRepeatedHoliday(
    @Request() req: any,
    @Param('calendarId') calendarId: number,
    @Param('day') day: number,
  ) {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.calendarService.deleteRepeatedHoliday(
      calendarId,
      Number(day),
      req.user,
      activeCompanyId,
    );
  }

  @Get('active-weeks/:companyId')
  async getActiveCalendarWeeks(@Param('companyId') companyId: number) {
    return this.calendarService.getActiveCalendarWeeks(companyId);
  }
}
