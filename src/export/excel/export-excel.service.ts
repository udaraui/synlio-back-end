import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { CommonDbOperationService } from '../../common/common-db-operation/common-db-operation.service';
import { QueryParamFilter, QueryParamSort } from '../../common/common-db-operation/common-db-operation-query-param.dto';

/**
 * Maximum number of rows fetched for a single export.
 * Adjust this constant to increase or decrease the export limit.
 */
const EXPORT_ROW_LIMIT = 30_000;

@Injectable()
export class ExportExcelService {
  constructor(
    private readonly commonDbOperationService: CommonDbOperationService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Task Export
  // ─────────────────────────────────────────────────────────────────────────
async exportTasks(
  filters: QueryParamFilter[],
  multiSorts: QueryParamSort[],
  res: Response,
): Promise<void> {
  const codeSort = multiSorts?.find(ms => ms.field === 'code');
  const otherSorts = codeSort ? multiSorts.filter(ms => ms.field !== 'code') : multiSorts;

  const { data } = await this.commonDbOperationService.search('tm_task', {
    filters,
    multiSorts: otherSorts,
    first: 0,
    rows: EXPORT_ROW_LIMIT,
    withRelations: ['status', 'severity', 'assignee', 'taskSpace'],
  });

  if (codeSort) {
    const parseCodeNumber = (code: string | null | undefined): number => {
      if (!code) return 0;
      const match = code.match(/-[a-zA-Z]*(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const orderDir = (codeSort.order === 'DESC' || codeSort.order === '-1' || +codeSort.order === -1) ? -1 : 1;

    data.sort((a: any, b: any) => {
      const numA = parseCodeNumber(a.code);
      const numB = parseCodeNumber(b.code);
      return (numA - numB) * orderDir;
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Synlio System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Tasks');

  // ── Column definitions ─────────────────────────────────────────────────
  sheet.columns = [
    { header: 'Code', key: 'code', width: 16 },
    { header: 'Name', key: 'name', width: 45 }, // Slightly wider for hierarchical indent
    { header: 'Status', key: 'statusName', width: 18 },
    { header: 'Severity', key: 'severityName', width: 18 },
    { header: 'Assignee', key: 'assigneeName', width: 24 },
    { header: 'Space', key: 'taskSpaceName', width: 24 },
    { header: 'Hierarchy Level', key: 'hierarchyLevelName', width: 20 },
    { header: 'Progress (%)', key: 'progressPercentage', width: 14 },
    { header: 'Start Date', key: 'startDate', width: 16 },
    { header: 'Due Date', key: 'dueDate', width: 16 },
    { header: 'Completion Date', key: 'completionDate', width: 18 },
    { header: 'Estimate Effort', key: 'estimateEffort', width: 16 },
    { header: 'Actual Effort', key: 'actualEffort', width: 16 },
    { header: 'Created At', key: 'createdAt', width: 22 },
    { header: 'Created By', key: 'createdBy', width: 28 },
  ];

  // ── Style the header row ───────────────────────────────────────────────
  this.styleHeaderRow(sheet);

  // ── 1. Build Hierarchical Tree Structure In-Memory ──────────────────────
  const taskMap = new Map<number, any>();
  const childrenMap = new Map<number, any[]>();
  const rootTasks: any[] = [];

  // Map every task by its ID
  for (const task of data as any[]) {
    taskMap.set(task.id, task);
  }

  // Separate root tasks from child subtasks
  for (const task of data as any[]) {
    // If it has a parent and that parent is present in our current dataset, group it under the parent
    if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
      if (!childrenMap.has(task.parentTaskId)) {
        childrenMap.set(task.parentTaskId, []);
      }
      childrenMap.get(task.parentTaskId)!.push(task);
    } else {
      // Otherwise, treat it as a top-level root task for this export
      rootTasks.push(task);
    }
  }

  // Optional: Sort groups by sequence/code so they appear uniformly
  const sortTasksBySequence = (tasks: any[]) => {
    return tasks.sort((a, b) => {
      if (a.hierarchyLevelSequence !== b.hierarchyLevelSequence) {
        return (a.hierarchyLevelSequence ?? 0) - (b.hierarchyLevelSequence ?? 0);
      }
      return (a.code || '').localeCompare(b.code || '');
    });
  };

  sortTasksBySequence(rootTasks);
  childrenMap.forEach((childrenList) => sortTasksBySequence(childrenList));

  // ── 2. Flatten Using Depth-First Search (DFS) ───────────────────────────
  const orderedTasks: { task: any; depth: number }[] = [];

  const traverse = (task: any, depth: number) => {
    orderedTasks.push({ task, depth });
    const children = childrenMap.get(task.id) || [];
    for (const child of children) {
      traverse(child, depth + 1);
    }
  };

  for (const root of rootTasks) {
    traverse(root, 0);
  }

  // ── 3. Populate Rows into the Excel Sheet ──────────────────────────────
  for (const { task, depth } of orderedTasks) {
    // Extract values from denormalized fields or fallback to relations
    const statusName = task.statusName || task.status?.name || '';
    const severityName = task.severityName || task.severity?.name || '';
    const assigneeName = task.assigneeName || this.formatAssigneeName(task.assignee) || '';
    const taskSpaceName = task.taskSpaceName || task.taskSpace?.name || '';

    // Create a visual indentation space block based on depth (4 spaces per sub-level)
    const indentation = '    '.repeat(depth);

    sheet.addRow({
      code: task.code ?? '',
      // Indent the name field visually to reflect parent-child relationship
      name: `${indentation}${task.name ?? ''}`,
      statusName,
      severityName,
      assigneeName,
      taskSpaceName,
      hierarchyLevelName: task.hierarchyLevelName ?? '',
      progressPercentage: task.progressPercentage ?? 0,
      startDate: task.startDate ? this.formatDate(task.startDate) : '',
      dueDate: task.dueDate ? this.formatDate(task.dueDate) : '',
      completionDate: task.completionDate ? this.formatDate(task.completionDate) : '',
      estimateEffort: task.estimateEffort ?? 0,
      actualEffort: task.actualEffort ?? 0,
      createdAt: task.createdAt ? this.formatDateTime(task.createdAt) : '',
      createdBy: task.createdBy ?? '',
    });
  }

  await this.streamWorkbook(workbook, 'tasks_export.xlsx', res);
}


  async exportTickets(
    filters: QueryParamFilter[],
    multiSorts: QueryParamSort[],
    res: Response,
  ): Promise<void> {
    const { data } = await this.commonDbOperationService.search('ticket', {
      filters,
      multiSorts,
      first: 0,
      rows: EXPORT_ROW_LIMIT,
      withRelations: ['status', 'severity', 'assignee', 'queue', 'ticketType', 'ticketSpace'],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Synlio System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Tickets');

    // ── Column definitions ─────────────────────────────────────────────────
    sheet.columns = [
      { header: 'Code', key: 'code', width: 16 },
      { header: 'Name', key: 'name', width: 40 },
      { header: 'Status', key: 'statusName', width: 18 },
      { header: 'Severity', key: 'severityName', width: 18 },
      { header: 'Assignee', key: 'assigneeName', width: 24 },
      { header: 'Space', key: 'ticketSpaceName', width: 24 },
      { header: 'Queue', key: 'queueName', width: 20 },
      { header: 'Type', key: 'ticketTypeName', width: 18 },
      { header: 'Impact', key: 'impactName', width: 18 },
      { header: 'Department', key: 'departmentName', width: 22 },
      { header: 'Planned Effort', key: 'plannedEffort', width: 16 },
      { header: 'Actual Effort', key: 'actualEffort', width: 16 },
      { header: 'Completion Date', key: 'completionDate', width: 18 },
      { header: 'SLA Response Deadline', key: 'slaResponseDeadline', width: 26 },
      { header: 'SLA Resolution Deadline', key: 'slaResolutionDeadline', width: 28 },
      { header: 'Created At', key: 'createdAt', width: 22 },
      { header: 'Created By', key: 'createdBy', width: 28 },
    ];

    // ── Style the header row ───────────────────────────────────────────────
    this.styleHeaderRow(sheet);

    // ── Populate rows ──────────────────────────────────────────────────────
    for (const row of data as any[]) {
      // Extract values from denormalized fields or fallback to relations
      const statusName = row.statusName || row.status?.name || '';
      const severityName = row.severityName || row.severity?.name || '';
      const assigneeName =
        row.assigneeName || this.formatAssigneeName(row.assignee) || '';
      const ticketSpaceName = row.ticketSpaceName || row.ticketSpace?.name || '';
      const queueName = row.queueName || row.queue?.name || '';
      const ticketTypeName =
        row.ticketTypeName || row.ticketType?.name || '';
      const impactName = row.impactName || row.impact?.name || '';
      const departmentName = row.departmentName || row.department?.name || '';

      sheet.addRow({
        code: row.code ?? '',
        name: row.name ?? '',
        statusName,
        severityName,
        assigneeName,
        ticketSpaceName,
        queueName,
        ticketTypeName,
        impactName,
        departmentName,
        plannedEffort: row.plannedEffort ?? '',
        actualEffort: row.actualEffort ?? '',
        completionDate: row.completionDate ? this.formatDate(row.completionDate) : '',
        slaResponseDeadline: row.slaResponseDeadline
          ? this.formatDateTime(row.slaResponseDeadline)
          : '',
        slaResolutionDeadline: row.slaResolutionDeadline
          ? this.formatDateTime(row.slaResolutionDeadline)
          : '',
        createdAt: row.createdAt ? this.formatDateTime(row.createdAt) : '',
        createdBy: row.createdBy ?? '',
      });
    }

    await this.streamWorkbook(workbook, 'tickets_export.xlsx', res);
  }


  async downloadUserTemplate(res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Synlio System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('User Import Template');

    // ── Column definitions matching formSchema ─────────────────────────────
    // Asterisks (*) indicate fields marked mandatory in your Zod schema
    sheet.columns = [
      { header: 'First Name *', key: 'first_name', width: 20 },
      { header: 'Last Name *', key: 'last_name', width: 20 },
      { header: 'Email *', key: 'email', width: 32 },
      { header: 'Phone Number *', key: 'phone_number', width: 22 },
      { header: 'Password *', key: 'password', width: 22 },
      { header: 'Divisions (Comma Separated)', key: 'divisions', width: 30 },
      { header: 'Roles (Comma Separated)', key: 'roles', width: 30 },
      { header: 'Profile Picture (Insert Image)', key: 'profile_picture', width: 25 },
    ];

    // ── Style the header row using your existing helper ─────────────────────
    this.styleHeaderRow(sheet);

    // ── Add an instructive sample row ──────────────────────────────────────
    sheet.addRow({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@company.com',
      phone_number: '+15550199',
      password: 'SecurePassword123!',
      divisions: 'Management, Engineering', 
      roles: 'Admin, Project Manager',
      profile_picture: '[Drag & Drop Image Here]',
    });

    // Optional: Add a subtle italicized font to the sample row to differentiate it
    const sampleRow = sheet.getRow(2);
    sampleRow.font = { italic: true, color: { argb: 'FF7F8C8D' } };

    await this.streamWorkbook(workbook, 'user_import_template.xlsx', res);
  }

  async downloadResourceTemplate(res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Synlio System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Resource Import Template');

    sheet.columns = [
      { header: 'First Name *', key: 'first_name', width: 20 },
      { header: 'Last Name *', key: 'last_name', width: 20 },
      { header: 'Email *', key: 'email', width: 32 },
      { header: 'Phone Number *', key: 'mobile', width: 22 },
      { header: 'Hours Per Day *', key: 'working_hours', width: 16 },
      { header: 'Division Name *', key: 'division', width: 24 },
      { header: 'Calendar Name *', key: 'calendar', width: 24 },
      { header: 'Reporting Manager Email', key: 'reporting_email', width: 30 },
      { header: 'Cost Value', key: 'cost', width: 16 },
      { header: 'Currency Code', key: 'currency_code', width: 16 },
      { header: 'Rate Type (per_day/per_hour)', key: 'rate_type', width: 26 },
      { header: 'Profile Picture (Insert Image)', key: 'profile_pic', width: 28 },

      { header: 'Skill 1 Category', key: 'skill_1_cat', width: 22 },
      { header: 'Skill 1 Name', key: 'skill_1_name', width: 22 },
      { header: 'Skill 1 Level', key: 'skill_1_level', width: 18 },
    ];

    this.styleHeaderRow(sheet);
    sheet.getRow(1).height = 25; 

    // ── Add an instructive mockup resource data entry ──────────────────────
    const sampleRow = sheet.addRow({
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@company.com',
      mobile: '+15550144',
      working_hours: 8,                       // Matches default form value context
      division: 'Engineering',                 // Evaluated out to entity IDs during parsing
      calendar: 'Standard Shift',
      reporting_email: 'manager@company.com', // Best identifier method for internal linking
      cost: 120.00,
      currency_code: 'USD',
      rate_type: 'per_hour',
      profile_pic: '[Drag/Place Image Here]',

      skill_1_cat: 'Development',
      skill_1_name: 'Node.js',
      skill_1_level: 'Senior',
    }); 

    // ── Layout configuration adjustments ───────────────────────────────────
    sampleRow.font = { italic: true, color: { argb: 'FF7F8C8D' } };
    sampleRow.alignment = { vertical: 'middle', horizontal: 'left' };

    await this.streamWorkbook(workbook, 'resource_import_template.xlsx', res);
  }

  async downloadTicketTemplate(res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Synlio System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Ticket Import Template');

    sheet.columns = [
      { header: 'Ticket Name *', key: 'name', width: 30 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Status', key: 'statusName', width: 20 },
      { header: 'Type', key: 'typeName', width: 20 },
      { header: 'Severity', key: 'severityName', width: 20 },
      { header: 'Queue', key: 'queueName', width: 22 },
      { header: 'Impact', key: 'impactName', width: 20 },
      { header: 'Assignee Email', key: 'assigneeEmail', width: 30 },
      { header: 'Planned Effort (Hours)', key: 'plannedEffort', width: 22 },
      { header: 'Actual Effort (Hours)', key: 'actualEffort', width: 22 },
      { header: 'Completion Date (YYYY-MM-DD)', key: 'completionDate', width: 26 },
    ];

    this.styleHeaderRow(sheet);
    sheet.getRow(1).height = 25;

    const sampleRow = sheet.addRow({
      name: 'Fix login page layout glitch',
      description: 'Users on mobile screen observe overlapping login buttons',
      statusName: 'To Start',
      typeName: 'Bug',
      severityName: 'High',
      queueName: 'Development',
      impactName: 'Medium',
      assigneeEmail: 'john.doe@company.com',
      plannedEffort: 8,
      actualEffort: 4,
      completionDate: '2026-08-30',
    });

    sampleRow.font = { italic: true, color: { argb: 'FF7F8C8D' } };
    sampleRow.alignment = { vertical: 'middle', horizontal: 'left' };

    await this.streamWorkbook(workbook, 'ticket_import_template.xlsx', res);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shared helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Bold + background colour on the first (header) row. */
  private styleHeaderRow(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D6A4F' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;
  }

  /** Write the workbook buffer to the HTTP response. */
  private async streamWorkbook(
    workbook: ExcelJS.Workbook,
    filename: string,
    res: Response,
  ): Promise<void> {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  /** Format a date value (Date | string) as YYYY-MM-DD. */
  private formatDate(value: Date | string): string {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  /** Format a datetime value as YYYY-MM-DD HH:mm. */
  private formatDateTime(value: Date | string): string {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().replace('T', ' ').slice(0, 16);
  }

  /** Format assignee name from TicketSpaceMember or Resource object. */
  private formatAssigneeName(assignee: any): string {
    if (!assignee) return '';

    const firstName =
      assignee.first_name || assignee.userFirstName || assignee.firstName;
    const lastName =
      assignee.last_name || assignee.userLastName || assignee.lastName;
    if (firstName || lastName) {
      return `${firstName ?? ''} ${lastName ?? ''}`.trim();
    }

    return (
      assignee.email || assignee.userEmail || assignee.assigneeEmail || ''
    );
  }
}
