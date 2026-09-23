import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.gurard';
import { AuthorizationGuard } from '../authorization/decorator/authorization.guard';
import { AuthorizationPermissions } from '../authorization/decorator/authorization-permissions.decorator';
import { QueryParam } from '../common/common-db-operation/common-db-operation-query-param.dto';
import { TmTaskService } from '../task-management/task/task.service';
import { TicketService } from '../ticket-management/ticket/ticket.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, AuthorizationGuard)
export class DashboardController {
  constructor(
    private readonly taskService: TmTaskService,
    private readonly ticketService: TicketService,
  ) {}

  @AuthorizationPermissions('54')
  @Post('/task/search')
  searchTasks(
    @Body() item: QueryParam,
    @Request() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.taskService.searchWithStatus(item, activeCompanyId);
  }

  @AuthorizationPermissions('101')
  @Post('/ticket/search')
  searchTickets(
    @Body() item: QueryParam,
    @Request() req: any,
  ): Promise<{ total: number; data: object[] }> {
    const activeCompanyId = req.activeCompany?.companyId;
    return this.ticketService.searchWithStatus(item, activeCompanyId);
  }

  @AuthorizationPermissions('54')
  @Get('/my-tasks')
  getMyTasks(
    @Request() req: any,
    @Query('dates') dates?: string,
    @Query('rows') rows?: string,
    @Query('page') page?: string,
    @Query('windowFrom') windowFrom?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('tab') tab?: string,
  ): Promise<{ total: number; data: any[] }> {
    return this.taskService.findMyTasks(
      req.user.email as string,
      req.activeCompany?.companyId,
      dates,
      rows ? parseInt(rows, 10) : 100,
      page ? parseInt(page, 10) : 0,
      windowFrom,
      fromDate,
      toDate,
      tab,
    );
  }

  @AuthorizationPermissions('101')
  @Get('/my-tickets')
  getMyTickets(
    @Request() req: any,
    @Query('dates') dates?: string,
    @Query('rows') rows?: string,
    @Query('page') page?: string,
    @Query('windowFrom') windowFrom?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('tab') tab?: string,
  ): Promise<{ total: number; data: any[] }> {
    return this.ticketService.findMyTickets(
      req.user.userId as number,
      req.activeCompany?.companyId,
      dates,
      rows ? parseInt(rows, 10) : 100,
      page ? parseInt(page, 10) : 0,
      windowFrom,
      fromDate,
      toDate,
      tab,
    );
  }

  @AuthorizationPermissions('54')
  @Get('/my-counts')
  async getMyCounts(
    @Request() req: any,
    @Query('includeTasks') includeTasks?: string,
    @Query('includeTickets') includeTickets?: string,
  ): Promise<{
    dueTasks: number;
    dueTickets: number;
    dueTaskSpaces: string[];
    dueTicketSpaces: string[];
  }> {
    const withTasks = includeTasks !== 'false';
    const withTickets = includeTickets !== 'false';
    const empty = { total: 0, data: [] };
    // Single query per type — fetch all open items with space relations
    const [tasksResult, ticketsResult] = await Promise.all([
      withTasks
        ? this.taskService.findMyTasks(
            req.user.email as string,
            req.activeCompany?.companyId,
            undefined,
            100,
            0,
          )
        : empty,
      withTickets
        ? this.ticketService.findMyTickets(
            req.user.userId as number,
            req.activeCompany?.companyId,
            undefined,
            100,
            0,
          )
        : empty,
    ]);
    const dueTaskSpaces = [
      ...new Set(
        (tasksResult.data as any[])
          .map((t: any) => t.taskSpace?.name as string | undefined)
          .filter((n): n is string => !!n),
      ),
    ];

    const dueTicketSpaces = [
      ...new Set(
        (ticketsResult.data as any[])
          .map((t: any) => t.ticketSpace?.name as string | undefined)
          .filter((n): n is string => !!n),
      ),
    ];

    return {
      dueTasks: tasksResult.total,
      dueTickets: ticketsResult.total,
      dueTaskSpaces,
      dueTicketSpaces,
    };
  }

  @AuthorizationPermissions('54')
  @Get('/calendar-counts')
  async getCalendarCounts(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('includeTasks') includeTasks?: string,
    @Query('includeTickets') includeTickets?: string,
  ): Promise<
    Record<string, { tasks: number; tickets: number; meetings: number }>
  > {
    const withTasks = includeTasks !== 'false';
    const withTickets = includeTickets !== 'false';

    const [taskCounts, ticketCounts] = await Promise.all([
      withTasks
        ? this.taskService.getCalendarTaskCounts(
            req.user.email as string,
            req.activeCompany?.companyId,
            from,
            to,
          )
        : Promise.resolve({} as Record<string, number>),
      withTickets
        ? this.ticketService.getCalendarTicketCounts(
            req.user.userId as number,
            req.activeCompany?.companyId,
            from,
            to,
          )
        : Promise.resolve({} as Record<string, number>),
    ]);

    const allDates = new Set([
      ...Object.keys(taskCounts),
      ...Object.keys(ticketCounts),
    ]);
    const result: Record<
      string,
      { tasks: number; tickets: number; meetings: number }
    > = {};
    for (const date of allDates) {
      result[date] = {
        tasks: taskCounts[date] ?? 0,
        tickets: ticketCounts[date] ?? 0,
        meetings: 0,
      };
    }
    return result;
  }

  @AuthorizationPermissions('54')
  @Get('/my-task-spaces')
  getMyTaskSpaces(@Request() req: any): Promise<
    {
      id: number;
      name: string;
      prefix: string;
      avgProgress: number;
      taskCount: number;
      rootLevelName: string | null;
      rootLevelIcon: string | null;
      rootLevelColor: string | null;
    }[]
  > {
    const activeCompanyId = req.activeCompany?.companyId;
    const isSystemScope = !activeCompanyId || activeCompanyId === 0;
    const companyPrivileges = ((req.user.privileges as any[]) ?? []).find(
      (p: any) =>
        isSystemScope
          ? p.companyId === 0 || p.companyId === null
          : p.companyId === activeCompanyId,
    );
    const privilegeIds: number[] = companyPrivileges?.privilegeIds ?? [];
    const viewAll = privilegeIds.includes(105);
    return this.taskService.getMyTaskSpaces(
      req.user.email as string,
      activeCompanyId,
      viewAll,
    );
  }

  @AuthorizationPermissions('101')
  @Get('/my-ticket-spaces')
  getMyTicketSpaces(@Request() req: any): Promise<
    {
      id: number;
      name: string;
      prefix: string;
      completedCount: number;
      totalCount: number;
    }[]
  > {
    const activeCompanyId = req.activeCompany?.companyId;
    const isSystemScope = !activeCompanyId || activeCompanyId === 0;
    const companyPrivileges = ((req.user.privileges as any[]) ?? []).find(
      (p: any) =>
        isSystemScope
          ? p.companyId === 0 || p.companyId === null
          : p.companyId === activeCompanyId,
    );
    const privilegeIds: number[] = companyPrivileges?.privilegeIds ?? [];
    const viewAll = privilegeIds.includes(106);
    return this.ticketService.getMyTicketSpaces(
      req.user.userId as number,
      activeCompanyId,
      viewAll,
    );
  }
}
