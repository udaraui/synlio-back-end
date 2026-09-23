import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'vw_ticket_workload',
  schema: 'marts',
  synchronize: false,
  expression: `SELECT * FROM "marts"."vw_ticket_workload"`,
})
export class VwTicketWorkload {
  @ViewColumn() company_id: number;
  @ViewColumn() company_name: string;
  @ViewColumn() ticket_space_id: number;
  @ViewColumn() ticket_space_name: string;
  @ViewColumn() assignee_user_id: number;
  @ViewColumn() assignee_name: string;
  @ViewColumn() assignee_email: string;
  @ViewColumn() assigned_ticket_count: number;
  @ViewColumn() allocated_effort_hrs: number;
  @ViewColumn() overdue_count: number;
  @ViewColumn() avg_risk_score: number;
  @ViewColumn() weekly_capacity_hrs: number;
  @ViewColumn() utilization_pct: number;
  @ViewColumn() workload_status: string;
}