import { MigrationInterface, QueryRunner } from 'typeorm';

const VIEW_NAME = 'company_wise_resource_view';

export class UpdateCompanyWiseResource1765570373417
  implements MigrationInterface
{
  name = 'UpdateCompanyWiseResource1765570373417';

  private readonly newViewDefinition = `
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
             cm.id  AS "companyId",
             -- NEW: Filter-Friendly Column
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
                     '[]' ::jsonb
             )      AS "resourcePools"
      FROM public.resource r
               LEFT JOIN public.division d ON r."divisionId" = d.id
               LEFT JOIN public.calendar c ON r."calendarId" = c.id
               LEFT JOIN public.company cm ON r."companyId" = cm.id
               LEFT JOIN public.resource_pool_resources_resource rpr ON r.id = rpr."resourceId"
               LEFT JOIN public.resource_pool rp ON rpr."resourcePoolId" = rp.id
      GROUP BY r.id, r.first_name, r.last_name, r.email, r.mobile, r.profile_pic,
               r.active_status, r."createdBy", r."createdAt", r."updatedBy", r."updatedAt",
               c.name, c.id, d.division, d.id, cm.id
      ORDER BY r.id;
  `;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "${VIEW_NAME}" CASCADE;`);
    await queryRunner.query(
      `CREATE VIEW "${VIEW_NAME}" AS ${this.newViewDefinition}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "name" = '${VIEW_NAME}'`,
    );
    await queryRunner.query(`DROP VIEW IF EXISTS "${VIEW_NAME}" CASCADE;`);
  }
}
