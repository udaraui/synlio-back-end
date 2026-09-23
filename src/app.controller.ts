import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('email-preview')
  @Header('Content-Type', 'text/html')
  getEmailPreview(): string {
    const { 
      buildEmailHtml, buildChip, buildSeverityChip, 
      buildAssigneeChip, buildIconChip, buildDateChip, 
      buildCoAssigneesChip, buildChangeValue 
    } = require('./common/email/email-template.helper');

    const ticketTypeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
    const queueSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;

    return buildEmailHtml({
      breadcrumb: 'Space Name / Project Alpha / Epic Gamma',
      title: 'Database Migration Phase 2',
      actorInitials: 'JD',
      actorName: 'John Doe',
      actionSentence: 'John Doe updated this task',
      description: 'The migration looks good. Please proceed with the frontend updates. Make sure all indexes are properly created before running the script in production.',
      metaRows: [
        { label: 'Name', valueHtml: buildChangeValue('<span style="color:#64748b;text-decoration:line-through;font-size:13.5px;">DB Migration</span>', '<span style="color:#0f172a;font-weight:500;font-size:13.5px;">Database Migration Phase 2</span>') },
        { label: 'Description', valueHtml: buildChangeValue('<span style="color:#64748b;text-decoration:line-through;font-size:13.5px;">Old description text</span>', '<span style="color:#0f172a;font-size:13.5px;">New description text added here</span>') },
        { label: 'Status', valueHtml: buildChangeValue(buildChip('To Do', '#94a3b8', { muted: true }), buildChip('In Progress', '#3b82f6')) },
        { label: 'Severity', valueHtml: buildChangeValue(buildSeverityChip('Low', '#94a3b8', { muted: true }), buildSeverityChip('High', '#ef4444')) },
        { label: 'Ticket Type', valueHtml: buildIconChip('Bug', ticketTypeSvg) },
        { label: 'Queue', valueHtml: buildIconChip('Backend Team', queueSvg) },
        { label: 'Assignee', valueHtml: buildAssigneeChip('Alice Smith') },
        { label: 'Co-Assignees', valueHtml: buildCoAssigneesChip([{name: 'Bob Jones'}, {name: 'Charlie Brown'}]) },
        { label: 'Start Date', valueHtml: buildDateChip('Oct 24, 2026') },
        { label: 'Due Date', valueHtml: buildChangeValue(buildDateChip('Oct 25, 2026', { muted: true }), buildDateChip('Oct 30, 2026')) }
      ],
      ctaUrl: 'http://localhost:3000',
      ctaLabel: 'View Task'
    });
  }
}
