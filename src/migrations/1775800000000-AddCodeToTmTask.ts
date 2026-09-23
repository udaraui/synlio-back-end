import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCodeToTmTask1775800000000 implements MigrationInterface {
  name = 'AddCodeToTmTask1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the code column (nullable so existing rows are not broken)
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD COLUMN IF NOT EXISTS "code" varchar(100) NULL
    `);

    // Back-fill existing rows: {prefix}-{zero-padded id}
    await queryRunner.query(`
      UPDATE "tm_task" t
      SET "code" = ts.prefix || '-' || LPAD(t.id::text, 3, '0')
      FROM "task_space" ts
      WHERE t."taskSpaceId" = ts.id
        AND t."code" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        DROP COLUMN IF EXISTS "code"
    `);
  }
}

