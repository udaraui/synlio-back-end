import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'vw_resource_dashboard',
  schema: 'marts',
  synchronize: false,
  expression: `SELECT * FROM "marts"."vw_resource_dashboard"`,
})
export class VwResourceDashboard {
  @ViewColumn() resource_id: number;
  @ViewColumn() full_name: string;
  @ViewColumn() email: string;
  @ViewColumn() company_id: number;
  @ViewColumn() company_name: string;
  @ViewColumn() division_id: number;
  @ViewColumn() division_name: string;
  @ViewColumn() daily_working_hours: number;
  @ViewColumn() daily_cost: number;
  @ViewColumn() monthly_cost: number;
  @ViewColumn() currency_code: string;
  @ViewColumn() skill_list: string;
  @ViewColumn() skill_category_list: string;
  @ViewColumn() skill_count: number;
  @ViewColumn() active_task_count: number;
  @ViewColumn() active_ticket_count: number;
  @ViewColumn() allocated_effort_hrs: number;
  @ViewColumn() overdue_task_count: number;
  @ViewColumn() weekly_capacity_hrs: number;
  @ViewColumn() free_hours_this_week: number;
  @ViewColumn() utilization_pct: number;
  @ViewColumn() workload_status: string;
  @ViewColumn() total_resources: number;
  @ViewColumn() active_resources: number;
  @ViewColumn() total_cost_mtd: number;
  @ViewColumn() avg_cost_per_resource: number;
  @ViewColumn() highest_cost: number;
  @ViewColumn() avg_utilization_pct: number;
  @ViewColumn() overloaded_count: number;
  @ViewColumn() available_count: number;
  @ViewColumn() division_total_resources: number;
  @ViewColumn() division_avg_utilization: number;
  @ViewColumn() division_total_cost: number;
  @ViewColumn() anomaly_type: string;
  @ViewColumn() anomaly_severity: string;
  @ViewColumn() mart_refreshed_at: Date;
}
