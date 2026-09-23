import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActualDurationMinutes1781000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE meeting
        ADD COLUMN IF NOT EXISTS "actualDurationMinutes" int NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE meeting
        DROP COLUMN IF EXISTS "actualDurationMinutes";
    `);
  }
}
