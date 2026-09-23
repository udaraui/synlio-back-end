export class QueryParam {
  filters: QueryParamFilter[];
  first: number;
  rows: number;
  multiSorts: QueryParamSort[];
  /** ManyToOne relation names to load via LEFT JOIN in the main paginated query
   *  (safe for pagination — no row multiplication). e.g. ['status', 'severity', 'assignee'] */
  withRelations?: string[];
}

export class QueryParamFilter {
  field: string;
  value?: any;
  matchMode?: string;
}

export class QueryParamSort {
  field: string;
  order: string;
}
