import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'vw_resource_skill_gap',
  schema: 'marts',
  synchronize: false,
  expression: `SELECT * FROM "marts"."vw_resource_skill_gap"`,
})
export class VwResourceSkillGap {
  @ViewColumn() company_id: number;
  @ViewColumn() company_name: string;
  @ViewColumn() skill_category_name: string;
  @ViewColumn() skill_name: string;
  @ViewColumn() resources_with_skill: number;
  @ViewColumn() total_active_resources: number;
  @ViewColumn() skill_utilization_pct: number;
  @ViewColumn() required_count: number;
  @ViewColumn() gap_count: number;
  @ViewColumn() gap_status: string;
}
