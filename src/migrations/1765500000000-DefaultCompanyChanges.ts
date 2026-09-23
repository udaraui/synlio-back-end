import { MigrationInterface, QueryRunner } from "typeorm";

export class DefaultCompanyChanges1765500000000 implements MigrationInterface {
    name = 'DefaultCompanyChanges1765500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add defaultCompanyId to user table
        await queryRunner.query(`ALTER TABLE "user" ADD "defaultCompanyId" integer`);

        // Recreate user_company_view
        await queryRunner.query(`DROP VIEW IF EXISTS "user_company_view"`);
        await queryRunner.query(`
            CREATE OR REPLACE VIEW "user_company_view" AS
            SELECT uc."userId" as "userId",
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
            LEFT JOIN company as c ON c.id = uc."companyId"
            LEFT JOIN "user" as u ON u.id = uc."userId"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback view
        await queryRunner.query(`DROP VIEW IF EXISTS "user_company_view"`);
        await queryRunner.query(`
            CREATE OR REPLACE VIEW "user_company_view" AS
            SELECT uc."userId",
                c.id AS "companyId",
                c.company_code,
                c.company,
                c.logo,
                c."isActive",
                c."createdAt",
                c."updatedAt",
                c."createdBy",
                c."updatedBy"
            FROM user_companies_company uc
            LEFT JOIN company c ON c.id = uc."companyId"
        `);

        // Remove column
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "defaultCompanyId"`);
    }

}
