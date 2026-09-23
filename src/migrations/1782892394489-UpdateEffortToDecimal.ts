import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateEffortToDecimal1782892394489 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "tm_task" 
            ALTER COLUMN "estimateEffort" TYPE DECIMAL(10,2),
            ALTER COLUMN "actualEffort" TYPE DECIMAL(10,2);
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "tm_task" 
            ALTER COLUMN "estimateEffort" TYPE INTEGER,
            ALTER COLUMN "actualEffort" TYPE INTEGER;
        `);
  }
}
