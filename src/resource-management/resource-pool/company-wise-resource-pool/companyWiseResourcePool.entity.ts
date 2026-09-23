import { PrimaryColumn, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'company_wise_resourse_pool_view',
  synchronize: process.env.VIEW_SYNCHRONIZE === 'true',
  expression: `
      SELECT
          rp.id                              AS resource_pool_id,
          rp.name                            AS resource_pool_name,
          rp."isActive",
          rp."createdAt",
          rp."updatedAt",
          rp."createdBy",
          rp."updatedBy",
          d.id                               AS division_id,
          d.division                         AS division_name,
          owner.id                           AS pool_owner_id,
          owner.first_name                   AS pool_owner_first_name,
          owner.last_name                    AS pool_owner_last_name,
          owner.email                        AS pool_owner_email,
          owner.mobile_number                AS pool_owner_mobile,
          -- NEW: Select the company ID
          c.id                               AS company_id,
          json_agg(
                  json_build_object(
                          'resourceId', r.id,
                          'firstName',  r.first_name,
                          'lastName',   r.last_name,
                          'email',      r.email,
                          'profile_pic',      r.profile_pic, -- Fixed: Used r.profile_pic instead of r.lastName
                          'divisionId', r."divisionId",
                          'active',     r.active_status
                  ) ORDER BY r.id
          ) FILTER (WHERE r.id IS NOT NULL)   AS resources
      FROM public.resource_pool rp
               JOIN public.company c
                    ON c.id = rp."companyId"
               JOIN public.division d
                    ON d.id = rp."divisionId"
               LEFT JOIN public."user" owner
                         ON owner.id = rp."poolOwnerId"
               LEFT JOIN public.resource_pool_resources_resource rpr
                         ON rpr."resourcePoolId" = rp.id
               LEFT JOIN public.resource r
                         ON r.id = rpr."resourceId"
      GROUP BY
          rp.id,
          c.id,        -- Included in GROUP BY because it's selected
          d.id,
          owner.id;`,
})
export class CompanyWiseResourcePoolView {
  @ViewColumn()
  @PrimaryColumn()
  resource_pool_id: number;

  @ViewColumn()
  resource_pool_name: string;

  @ViewColumn()
  isActive: boolean;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  updatedAt: Date;

  @ViewColumn()
  createdBy: string;

  @ViewColumn()
  updatedBy: string;

  @ViewColumn()
  division_id: number;

  @ViewColumn()
  division_name: string;

  @ViewColumn()
  pool_owner_id: number;

  @ViewColumn()
  pool_owner_first_name: string;

  @ViewColumn()
  pool_owner_last_name: string;

  @ViewColumn()
  pool_owner_email: string;

  @ViewColumn()
  pool_owner_mobile: string;

  @ViewColumn()
  resources: any;
}
