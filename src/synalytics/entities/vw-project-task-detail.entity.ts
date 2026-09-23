import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'vw_project_task_detail',
  schema: 'marts',
  synchronize: false,
  expression: `SELECT * FROM "marts"."vw_project_task_detail"`,
})
export class VwProjectTaskDetail {
  @ViewColumn() task_id: number;
  @ViewColumn() task_code: string;
  @ViewColumn() task_name: string;
  @ViewColumn() task_description: string;
  @ViewColumn() company_id: number;
  @ViewColumn() company_name: string;
  @ViewColumn() company_code: string;
  @ViewColumn() division_id: number;
  @ViewColumn() division_name: string;
  @ViewColumn() task_space_id: number;
  @ViewColumn() task_space_name: string;
  @ViewColumn() status_name: string;
  @ViewColumn() status_group: string;
  @ViewColumn() status_color: string;
  @ViewColumn() status_base: string;
  @ViewColumn() severity_name: string;
  @ViewColumn() severity_color: string;
  @ViewColumn() assignee_resource_id: number;
  @ViewColumn() assignee_full_name: string;
  @ViewColumn() assignee_email: string;
  @ViewColumn() assignee_profile_pic: string;
  @ViewColumn() parent_task_id: number;
  @ViewColumn() hierarchy_level_sequence: number;
  @ViewColumn() hierarchy_level_name: string;
  @ViewColumn() hierarchy_level_configured_name: string;
  @ViewColumn() hierarchy_level_icon: string;
  @ViewColumn() hierarchy_level_color: string;
  @ViewColumn() planned_start_date: Date;
  @ViewColumn() planned_due_date: Date;
  @ViewColumn() actual_start_date: Date;
  @ViewColumn() actual_end_date: Date;
  @ViewColumn() estimate_effort_hrs: number;
  @ViewColumn() actual_effort_hrs: number;
  @ViewColumn() effort_variance_hrs: number;
  @ViewColumn() effort_variance_pct: number;
  @ViewColumn() schedule_variance_days: number;
  @ViewColumn() is_overdue: boolean;
  @ViewColumn() days_overdue: number;
  @ViewColumn() is_special: boolean;
  @ViewColumn() linked_task_count: number;
  @ViewColumn() task_health_score: number;
  @ViewColumn() progress_pct: number;
  @ViewColumn() co_assignee_count: number;
  @ViewColumn() created_at: Date;
  @ViewColumn() updated_at: Date;
  @ViewColumn() created_date: Date;
  @ViewColumn() created_month: string;
}