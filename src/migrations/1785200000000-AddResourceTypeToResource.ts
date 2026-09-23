import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourceTypeToResource1785200000000
  implements MigrationInterface
{
  name = 'AddResourceTypeToResource1785200000000';

  private readonly viewDefinition = `
      SELECT r.id   AS "resourceId",
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
             c.id   AS "calendarId",
             d.division,
             d.id   AS "divisionId",
             r."companyId" AS "companyId",
             -- Filter-Friendly Column
             COALESCE(
                     '|' || STRING_AGG(rp.id::text, '|') || '|',
                     ''
             )      AS "resourcePoolIdsText",
             -- Original aggregated JSON array
             COALESCE(
                     JSONB_AGG(
                             JSONB_BUILD_OBJECT(
                                     'pool_id', rp.id,
                                     'pool_name', rp.name
                             )
                     ) FILTER(WHERE rp.id IS NOT NULL),
                     '[]'::jsonb
             )      AS "resourcePools"
      FROM public.resource r
               LEFT JOIN public.division d ON r."divisionId" = d.id
               LEFT JOIN public.calendar c ON r."calendarId" = c.id
               LEFT JOIN public.resource_pool_resources_resource rpr ON r.id = rpr."resourceId"
               LEFT JOIN public.resource_pool rp ON rpr."resourcePoolId" = rp.id
      GROUP BY r.id, r.first_name, r.last_name, r.email, r.mobile, r.profile_pic,
               r.active_status, r.type, r."createdBy", r."createdAt", r."updatedBy", r."updatedAt",
               c.name, c.id, d.division, d.id
      ORDER BY r.id;
  `;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing view first as it depends on resource table schema
    await queryRunner.query(`DROP VIEW IF EXISTS "company_wise_resource_view" CASCADE;`);

    // 2. Create Enum type and add 'type' column
    await queryRunner.query(`CREATE TYPE "resource_type_enum" AS ENUM ('Internal', 'External')`);
    await queryRunner.query(`ALTER TABLE "resource" ADD "type" "resource_type_enum" NOT NULL DEFAULT 'Internal'`);

    // 3. Recreate view with type column
    await queryRunner.query(`CREATE VIEW "company_wise_resource_view" AS ${this.viewDefinition}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop view
    await queryRunner.query(`DROP VIEW IF EXISTS "company_wise_resource_view" CASCADE;`);

    // 2. Remove 'type' column and enum type
    await queryRunner.query(`ALTER TABLE "resource" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "resource_type_enum"`);

    // 3. Recreate old view definition (without type column)
    const oldViewDefinition = `
        SELECT r.id   AS "resourceId",
               r.first_name,
               r.last_name,
               r.email,
               r.mobile,
               r.profile_pic,
               r.active_status,
               r."createdBy",
               r."createdAt",
               r."updatedBy",
               r."updatedAt",
               c.name AS "calendarName",
               c.id   AS "calendarId",
               d.division,
               d.id   AS "divisionId",
               r."companyId" AS "companyId",
               -- Filter-Friendly Column
               COALESCE(
                       '|' || STRING_AGG(rp.id::text, '|') || '|',
                       ''
               )      AS "resourcePoolIdsText",
               -- Original aggregated JSON array
               COALESCE(
                       JSONB_AGG(
                               JSONB_BUILD_OBJECT(
                                       'pool_id', rp.id,
                                       'pool_name', rp.name
                               )
                       ) FILTER(WHERE rp.id IS NOT NULL),
                       '[]'::jsonb
               )      AS "resourcePools"
        FROM public.resource r
                 LEFT JOIN public.division d ON r."divisionId" = d.id
                 LEFT JOIN public.calendar c ON r."calendarId" = c.id
                 LEFT JOIN public.resource_pool_resources_resource rpr ON r.id = rpr."resourceId"
                 LEFT JOIN public.resource_pool rp ON rpr."resourcePoolId" = rp.id
        GROUP BY r.id, r.first_name, r.last_name, r.email, r.mobile, r.profile_pic,
                 r.active_status, r."createdBy", r."createdAt", r."updatedBy", r."updatedAt",
                 c.name, c.id, d.division, d.id
        ORDER BY r.id;
    `;
    await queryRunner.query(`CREATE VIEW "company_wise_resource_view" AS ${oldViewDefinition}`);
  }
}
