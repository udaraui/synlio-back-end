import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'vw_ticket_recent_list',
  schema: 'marts',
  synchronize: false,
  expression: `SELECT * FROM "marts"."vw_ticket_recent_list"`,
})
export class VwTicketRecentList {
  @ViewColumn() ticket_id: number;
  @ViewColumn() ticket_code: string;
  @ViewColumn() ticket_name: string;
  @ViewColumn() company_id: number;
  @ViewColumn() company_name: string;
  @ViewColumn() company_code: string;
  @ViewColumn() ticket_space_id: number;
  @ViewColumn() ticket_space_name: string;
  @ViewColumn() department_id: number;
  @ViewColumn() department_name: string;
  @ViewColumn() status_name: string;
  @ViewColumn() status_base: string;
  @ViewColumn() status_color: string;
  @ViewColumn() severity_name: string;
  @ViewColumn() severity_color: string;
  @ViewColumn() ticket_type_name: string;
  @ViewColumn() ticket_type_color: string;
  @ViewColumn() queue_name: string;
  @ViewColumn() assignee_user_id: number;
  @ViewColumn() assignee_name: string;
  @ViewColumn() assignee_email: string;
  @ViewColumn() is_assigned: boolean;
  @ViewColumn() is_unallocated: boolean;
  @ViewColumn() is_overdue: boolean;
  @ViewColumn() age_days: number;
  @ViewColumn() sla_response_hrs: number;
  @ViewColumn() sla_resolution_hrs: number;
  @ViewColumn() sla_response_status: string;
  @ViewColumn() sla_resolution_status: string;
  @ViewColumn() first_response_at: Date;
  @ViewColumn() resolved_at: Date;
  @ViewColumn() completion_date: Date;
  @ViewColumn() planned_effort_hours: number;
  @ViewColumn() actual_effort_hours: number;
  @ViewColumn() ticket_risk_score: number;
  @ViewColumn() created_at: Date;
  @ViewColumn() created_date: Date;
  @ViewColumn() created_month: string;
  @ViewColumn() created_week: string;
  @ViewColumn() ticket_version: number;
}