import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'vw_ticket_dashboard',
  schema: 'marts',
  synchronize: false,
  expression: `SELECT * FROM "marts"."vw_ticket_dashboard"`,
})
export class VwTicketDashboard {
  @ViewColumn() company_id: number;
  @ViewColumn() company_name: string;
  @ViewColumn() company_code: string;
  @ViewColumn() ticket_space_id: number;
  @ViewColumn() ticket_space_name: string;
  @ViewColumn() department_id: number;
  @ViewColumn() department_name: string;
  @ViewColumn() severity_id: number;
  @ViewColumn() priority_name: string;
  @ViewColumn() priority_color: string;
  @ViewColumn() ticket_type_id: number;
  @ViewColumn() ticket_type_name: string;
  @ViewColumn() ticket_type_color: string;
  @ViewColumn() queue_id: number;
  @ViewColumn() queue_name: string;
  @ViewColumn() status_id: number;
  @ViewColumn() status_name: string;
  @ViewColumn() status_base: string;
  @ViewColumn() created_date: Date;
  @ViewColumn() created_month: string;
  @ViewColumn() created_week: string;
  @ViewColumn() ticket_count: number;
  @ViewColumn() allocated_count: number;
  @ViewColumn() unallocated_count: number;
  @ViewColumn() overdue_count: number;
  @ViewColumn() open_count: number;
  @ViewColumn() resolved_count: number;
  @ViewColumn() total_planned_effort: number;
  @ViewColumn() total_actual_effort: number;
  @ViewColumn() sla_response_threshold_hrs: number;
  @ViewColumn() sla_resolution_threshold_hrs: number;
  @ViewColumn() sla_response_breach_count: number;
  @ViewColumn() sla_resolution_breach_count: number;
  @ViewColumn() avg_response_hrs: number;
  @ViewColumn() avg_resolution_hrs: number;
  @ViewColumn() resolution_rate_pct: number;
  @ViewColumn() avg_age_days: number;
  @ViewColumn() avg_risk_score: number;
  @ViewColumn() mart_refreshed_at: Date;
}