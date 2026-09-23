import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateConpanyWiseResourcePool1765455520873
  implements MigrationInterface
{
  name = 'UpdateConpanyWiseResourcePool1765455520873';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "name" = 'company_wise_resourse_pool_view'`,
    );
    await queryRunner.query(
      `DROP VIEW IF EXISTS "company_wise_resourse_pool_view"`,
    );

    // FIX: Using double quotes "isActive" to handle case sensitivity
    await queryRunner.query(`
            CREATE VIEW "company_wise_resourse_pool_view" AS
            SELECT
                rp.id                              AS resource_pool_id,
                rp.name                            AS resource_pool_name,
                rp."isActive",                     -- FIXED: Added quotes here
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
                json_agg(
                  json_build_object(
                    'resourceId', r.id,
                    'firstName',  r.first_name,
                    'lastName',   r.last_name,
                    'email',      r.email,
                    'profile_pic', r.profile_pic,
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
                c.id,
                d.id,
                owner.id;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "name" = 'company_wise_resourse_pool_view'`,
    );
    await queryRunner.query(
      `DROP VIEW IF EXISTS "company_wise_resourse_pool_view"`,
    );
    await queryRunner.query(`
            CREATE VIEW "company_wise_resourse_pool_view" AS
            SELECT
                rp.id                              AS resource_pool_id,
                rp.name                            AS resource_pool_name,
                rp."isActive",                     -- FIXED: Added quotes here
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
                json_agg(
                  json_build_object(
                    'resourceId', r.id,
                    'firstName',  r.first_name,
                    'lastName',   r.last_name,
                    'email',      r.email,
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
                c.id,
                d.id,
                owner.id;
        `);
  }
}
