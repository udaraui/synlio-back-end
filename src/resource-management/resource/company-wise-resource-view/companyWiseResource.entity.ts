import { PrimaryColumn, ViewColumn, ViewEntity } from 'typeorm';

export interface ResourcePoolDetail {
  pool_id: number;
  pool_name: string;
}

@ViewEntity({
  name: 'company_wise_resource_view',
  synchronize: process.env.VIEW_SYNCHRONIZE === 'true',
  expression: `
      SELECT
          r.id AS "resourceId",
          r.first_name,
          r.last_name,
          r.email,
          r.mobile,
          r.profile_pic,
          r.active_status,
          r.type,
          r."createdBy",
          r."createdAt",
          r."updatedBy",
          r."updatedAt",
          c.name AS "calendarName",
          c.id AS "calendarId",
          d.division,
          d.id AS "divisionId",
          r.companyId AS "companyId",
          -- New Filter-Friendly Column: Concatenated IDs
          COALESCE(
                  '|' || STRING_AGG(rp.id::text, '|') || '|',
                  ''
          ) AS "resourcePoolIdsText",
          -- Original resourcePools JSON array (kept for application use)
          COALESCE(
                  JSONB_AGG(
                          JSONB_BUILD_OBJECT(
                                  'pool_id', rp.id,
                                  'pool_name', rp.name
                          )
                  ) FILTER (WHERE rp.id IS NOT NULL),
                  '[]'::jsonb
          ) AS "resourcePools",
          -- Reporting Person JSON object
          CASE 
              WHEN rp_person.id IS NOT NULL THEN
                  JSONB_BUILD_OBJECT(
                      'id', rp_person.id,
                      'first_name', rp_person.first_name,
                      'last_name', rp_person.last_name,
                      'email', rp_person.email
                  )
              ELSE NULL
          END AS "reportingPerson"
      FROM
          public.resource r
              LEFT JOIN public.division d ON r."divisionId" = d.id
              LEFT JOIN public.calendar c ON r."calendarId" = c.id
              LEFT JOIN public.resource rp_person ON r."reportingPersonId" = rp_person.id
              LEFT JOIN public.resource_pool_resources_resource rpr ON r.id = rpr."resourceId"
              LEFT JOIN public.resource_pool rp ON rpr."resourcePoolId" = rp.id
      GROUP BY
          r.id, r.first_name, r.last_name, r.email, r.mobile, r.profile_pic,
          r.active_status, r.type, r."createdBy", r."createdAt", r."updatedBy", r."updatedAt",
          c.name, c.id, d.division, d.id,
          rp_person.id, rp_person.first_name, rp_person.last_name, rp_person.email
      ORDER BY
          r.id;`,
})
export class CompanyWiseResourceView {
  @ViewColumn()
  @PrimaryColumn()
  resourceId: number;

  @ViewColumn()
  first_name: string;

  @ViewColumn()
  last_name: string;

  @ViewColumn()
  email: string;

  @ViewColumn()
  mobile: number;

  @ViewColumn()
  profile_pic: string;

  @ViewColumn()
  active_status: boolean;

  @ViewColumn()
  type: string;

  @ViewColumn()
  createdBy: string;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  updatedBy: string;

  @ViewColumn()
  updatedAt: Date;

  @ViewColumn()
  calendarName: string;

  @ViewColumn()
  calendarId: number;

  @ViewColumn()
  division: string;

  @ViewColumn()
  divisionId: number;

  @ViewColumn()
  companyId: number;

  @ViewColumn()
  resourcePoolIdsText: string;

  @ViewColumn()
  resourcePools: ResourcePoolDetail[];

  @ViewColumn()
  reportingPerson: object | null;
}
