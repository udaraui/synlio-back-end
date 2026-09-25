import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixMultiCompanyUserVisibilityInView1785600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "company_wise_user_view"`);
    await queryRunner.query(`
      CREATE VIEW "company_wise_user_view" AS
      SELECT
        u.id,
        uc."companyId",
        u.first_name,
        u.last_name,
        u.email,
        u.mobile_number,
        u.profile_picture,
        u."isActive",
        u."createdAt",
        u."updatedAt"
      FROM public."user" u
      JOIN public.user_companies_company uc
        ON u.id = uc."userId"
      ORDER BY u.id ASC;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "company_wise_user_view"`);
    // Restore the old (broken) view for rollback
    await queryRunner.query(`
      CREATE VIEW "company_wise_user_view" AS
      SELECT DISTINCT ON (u.id)
        u.id,
        uc."companyId",
        u.first_name,
        u.last_name,
        u.email,
        u.mobile_number,
        u.profile_picture,
        u."isActive",
        u."createdAt",
        u."updatedAt"
      FROM public."user" u
      JOIN public.user_companies_company uc
        ON u.id = uc."userId"
      ORDER BY u.id ASC;
    `);
  }
}
