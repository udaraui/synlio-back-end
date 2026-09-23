import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'vw_project_dashboard',
  schema: 'marts',
  synchronize: false,
  expression: `SELECT * FROM "marts"."vw_project_dashboard"`,
})
export class VwProjectDashboard {
  @ViewColumn() company_id: number;
  @ViewColumn() company_name: string;
  @ViewColumn() company_code: string;
  @ViewColumn() division_id: number;
  @ViewColumn() division_name: string;
  @ViewColumn() task_space_id: number;
  @ViewColumn() task_space_name: string;
  @ViewColumn() hierarchy_level_sequence: number;
  @ViewColumn() hierarchy_level_configured_name: string;
  @ViewColumn() hierarchy_level_icon: string;
  @ViewColumn() hierarchy_level_color: string;
  @ViewColumn() is_root_level: boolean;
  @ViewColumn() is_deepest_level: boolean;
  @ViewColumn() total_items: number;
  @ViewColumn() completed_items: number;
  @ViewColumn() in_progress_items: number;
  @ViewColumn() blocked_items: number;
  @ViewColumn() overdue_items: number;
  @ViewColumn() count_based_progress_pct: number;
  @ViewColumn() effort_weighted_progress_pct: number;
  @ViewColumn() items_with_effort_count: number;
  @ViewColumn() avg_health_score: number;
  @ViewColumn() total_planned_effort_hrs: number;
  @ViewColumn() total_actual_effort_hrs: number;
  @ViewColumn() effort_variance_hrs: number;
  @ViewColumn() effort_variance_pct: number;
  @ViewColumn() earliest_start_date: Date;
  @ViewColumn() latest_planned_end: Date;
  @ViewColumn() latest_actual_end: Date;
  @ViewColumn() schedule_delay_days: number;
  @ViewColumn() avg_task_health_score: number;
  @ViewColumn() mart_refreshed_at: Date;
}
