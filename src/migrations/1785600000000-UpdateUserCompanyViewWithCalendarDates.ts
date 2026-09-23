import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserCompanyViewWithCalendarDates1785600000000 implements MigrationInterface {
    name = 'UpdateUserCompanyViewWithCalendarDates1785600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS "user_company_view"`);
        await queryRunner.query(`
            CREATE VIEW "user_company_view" AS
            SELECT  uc."userId" as "userId",
              c."id" as "companyId",
              c."company_code",
              c."company",
              c."logo",
              c."isActive",
              c."createdAt",
              c."updatedAt",
              c."createdBy",
              c."updatedBy",
              c."weekEndDay",
              (u."defaultCompanyId" = c.id) as "is_default",
              cd."weekStartDate",
              cd."weekEndDate"
            FROM public.user_companies_company as uc
            LEFT JOIN company as c 
            on c.id = uc."companyId"
            LEFT JOIN "user" as u
            on u.id = uc."userId"
            LEFT JOIN (
              SELECT "companyId", id as "calendarId"
              FROM calendar
              WHERE "isActive" = true
            ) cal ON cal."companyId" = c.id
            LEFT JOIN calendar_days cd ON cd."calendarId" = cal."calendarId" AND cd.date = CURRENT_DATE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS "user_company_view"`);
        await queryRunner.query(`
            CREATE VIEW "user_company_view" AS
            SELECT  uc."userId" as "userId",
              c."id" as "companyId",
              c."company_code",
              c."company",
              c."logo",
              c."isActive",
              c."createdAt",
              c."updatedAt",
              c."createdBy",
              c."updatedBy",
              c."weekEndDay",
              (u."defaultCompanyId" = c.id) as "is_default"
            FROM public.user_companies_company as uc
            LEFT JOIN company as c 
            on c.id = uc."companyId"
            LEFT JOIN "user" as u
            on u.id = uc."userId"
        `);
    }
}
