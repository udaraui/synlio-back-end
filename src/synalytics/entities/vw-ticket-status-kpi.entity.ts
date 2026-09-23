import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'vw_ticket_status_kpi',
  schema: 'marts',
  synchronize: false,
  expression: `SELECT * FROM "marts"."vw_ticket_status_kpi"`,
})
export class VwTicketStatusKpi {
  @ViewColumn() company_id: number;
  @ViewColumn() company_name: string;
  @ViewColumn() ticket_space_id: number;
  @ViewColumn() ticket_space_name: string;
  @ViewColumn() trend_date: Date;
  @ViewColumn() day_name: string;
  @ViewColumn() status_name: string;
  @ViewColumn() status_base: string;
  @ViewColumn() status_color: string;
  @ViewColumn() ticket_count: number;
  @ViewColumn() avg_resolution_hrs: number;
  @ViewColumn() avg_response_hrs: number;
  @ViewColumn() resolution_rate_pct: number;
  @ViewColumn() sla_response_breach_count: number;
  @ViewColumn() sla_resolution_breach_count: number;
  @ViewColumn() mart_refreshed_at: Date;
}

