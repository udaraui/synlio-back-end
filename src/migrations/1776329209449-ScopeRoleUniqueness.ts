import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScopeRoleUniqueness1776329209449 implements MigrationInterface {
  name = 'ScopeRoleUniqueness1776329209449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role" DROP CONSTRAINT IF EXISTS "UQ_367aad98203bd8afaed0d704093"`,
    );

    // 2. Check if the new constraint is missing before adding it
    const constraintExists = await queryRunner.query(`
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'UQ_c9ed95d044419ad85f9b2f94eec'
    `);

    if (constraintExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "role" ADD CONSTRAINT "UQ_c9ed95d044419ad85f9b2f94eec" UNIQUE ("role", "companyId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role" DROP CONSTRAINT "UQ_c9ed95d044419ad85f9b2f94eec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role" ADD CONSTRAINT "UQ_367aad98203bd8afaed0d704093" UNIQUE ("role")`,
    );
  }
}
