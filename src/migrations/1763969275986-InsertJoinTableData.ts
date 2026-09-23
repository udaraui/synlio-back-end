import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsertJoinTableData1763969275986 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if user with email 'admin@unleashideas.com' exists
    const user = await queryRunner.query(
      `SELECT id FROM "user" WHERE email = 'admin@unleashideas.com'`,
    );

    if (!user || user.length === 0) {
      console.log(
        'User admin@unleashideas.com not found, skipping join table data insertion',
      );
      return;
    }

    const userId = user[0].id;

    // Insert into user_companies_company
    await queryRunner.query(
      `INSERT INTO public.user_companies_company("userId", "companyId")
       VALUES($1, 1)
       ON CONFLICT DO NOTHING`,
      [userId],
    );

    // Insert into user_company_role - check if already exists first
    const existingRole = await queryRunner.query(
      `SELECT id FROM user_company_role WHERE "userId" = $1 AND "companyId" = 1`,
      [userId],
    );

    if (!existingRole || existingRole.length === 0) {
      await queryRunner.query(
        `INSERT INTO public.user_company_role(id, "userId", "companyId", "roleId")
         VALUES(1, $1, 1, 1)
         ON CONFLICT (id) DO NOTHING`,
        [userId],
      );
    }

    // Insert into user_divisions_division
    await queryRunner.query(
      `INSERT INTO public.user_divisions_division("userId", "divisionId")
       VALUES($1, 1)
       ON CONFLICT DO NOTHING`,
      [userId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE
        FROM public.user_companies_company
        WHERE "userId" = 1
          AND "companyId" = 1;

        DELETE
        FROM public.user_company_role
        WHERE id = 1;

        DELETE
        FROM public.user_divisions_division
        WHERE "userId" = 1
          AND "divisionId" = 1;

        DELETE
        FROM public.company
        WHERE id = 1;

        DELETE
        FROM public.role
        WHERE id = 1;

        DELETE
        FROM public.division
        WHERE id = 1;
      `,
    );
  }
}
