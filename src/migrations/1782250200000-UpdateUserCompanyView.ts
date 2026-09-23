import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserCompanyView1782250200000 implements MigrationInterface {
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
          (u."defaultCompanyId" = c.id) as "is_default"
          FROM public.user_companies_company as uc
          LEFT JOIN company as c 
          on c.id = uc."companyId"
          LEFT JOIN "user" as u
          on u.id = uc."userId"
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
          (u."defaultCompanyId" = c.id) as "is_default"
          FROM public.user_companies_company as uc
          LEFT JOIN company as c 
          on c.id = uc."companyId"
          LEFT JOIN "user" as u
          on u.id = uc."userId"
    `);
  }
}
