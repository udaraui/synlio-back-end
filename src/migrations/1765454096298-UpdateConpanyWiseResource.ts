import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateConpanyWiseResource1765454096298
  implements MigrationInterface
{
  name = 'UpdateConpanyWiseResource1765454096298';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "name" = 'company_wise_resource_view'`,
    );
    await queryRunner.query(`DROP VIEW IF EXISTS "company_wise_resource_view"`);
    await queryRunner.query(`
            CREATE VIEW "company_wise_resource_view" AS
            SELECT 
                r.id as "resourceId",
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
                c.name as "calendarName",
                c.id as "calendarId",
                d.division,
                d.id as "divisionId",
                cm.id as "companyId"
            FROM public.resource r
            LEFT JOIN public.division d ON r."divisionId" = d.id 
            LEFT JOIN public.calendar c ON r."calendarId" = c.id 
            LEFT JOIN public.company cm ON r."companyId" = cm.id
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "name" = 'company_wise_resource_view'`,
    );
    await queryRunner.query(`DROP VIEW IF EXISTS "company_wise_resource_view"`);
    await queryRunner.query(`
            CREATE VIEW "company_wise_resource_view" AS
            SELECT 
                r.id as "resourceId",
                r.first_name,
                r.last_name,
                r.email,
                r.active_status,
                r."createdBy",
                r."createdAt",
                r."updatedBy",
                r."updatedAt",
                c.name as "calendarName",
                c.id as "calendarId",
                d.division,
                d.id as "divisionId",
                cm.id as "companyId"
            FROM public.resource r
            LEFT JOIN public.division d ON r."divisionId" = d.id 
            LEFT JOIN public.calendar c ON r."calendarId" = c.id 
            LEFT JOIN public.company cm ON r."companyId" = cm.id
        `);
  }
}
