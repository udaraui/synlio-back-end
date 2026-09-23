import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUniqueNameFromStatusAndSeverity1775400000000
  implements MigrationInterface
{
  name = 'RemoveUniqueNameFromStatusAndSeverity1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop unique constraint on status.name
    await queryRunner.query(`
      ALTER TABLE "status" DROP CONSTRAINT IF EXISTS "UQ_status_name"
    `);

    // Drop unique constraint on severity.name
    await queryRunner.query(`
      ALTER TABLE "severity" DROP CONSTRAINT IF EXISTS "UQ_severity_name"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore unique constraint on severity.name
    await queryRunner.query(`
      ALTER TABLE "severity" ADD CONSTRAINT "UQ_severity_name" UNIQUE ("name")
    `);

    // Restore unique constraint on status.name
    await queryRunner.query(`
      ALTER TABLE "status" ADD CONSTRAINT "UQ_status_name" UNIQUE ("name")
    `);
  }
}

