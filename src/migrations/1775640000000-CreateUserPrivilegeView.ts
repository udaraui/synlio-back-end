import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPrivilegeView1775640000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old aggregated string-based privilege view
    await queryRunner.query(`DROP VIEW IF EXISTS user_company_privilege_view CASCADE`);

    // Create the new granular per-privilege view
    await queryRunner.query(`
      CREATE OR REPLACE VIEW user_privilege_view AS
      SELECT
        ucr."userId",
        ucr."companyId",
        p.id AS "privilegeId",
        MAX(p.privilege) AS privilege,
        MAX(p.access_key) AS access_key,
        MAX(p.description) AS description,
        MAX(p.level_type) AS level_type
      FROM public.user_company_role AS ucr
      INNER JOIN role_privileges_privilege rpp
        ON rpp."roleId" = ucr."roleId"
      INNER JOIN privilege p
        ON p.id = rpp."privilegeId"
      GROUP BY ucr."userId", ucr."companyId", p.id
      ORDER BY ucr."userId", ucr."companyId", p.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new view
    await queryRunner.query(`DROP VIEW IF EXISTS user_privilege_view CASCADE`);

    // Restore the old user_company_privilege_view
    await queryRunner.query(`
      CREATE OR REPLACE VIEW user_company_privilege_view AS
      SELECT
        ucr."userId",
        ucr."companyId",
        STRING_AGG(p.access_key, ',') AS access_key
      FROM public.user_company_role AS ucr
      LEFT JOIN public.role_privileges_privilege AS rp
        ON ucr."roleId" = rp."roleId"
      LEFT JOIN public.privilege AS p
        ON rp."privilegeId" = p.id
      LEFT JOIN public.company AS c
        ON c."id" = ucr."companyId"
      WHERE c."isActive" = 'active'
      GROUP BY ucr."userId", ucr."companyId"
    `);
  }
}
