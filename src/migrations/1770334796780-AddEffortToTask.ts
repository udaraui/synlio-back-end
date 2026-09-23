import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEffortToTask1770334796780 implements MigrationInterface {
  name = 'AddEffortToTask1770334796780';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Only add the two new columns
    await queryRunner.query(
      `ALTER TABLE "task" ADD "estimateEffort" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task" ADD "actualEffort" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove them if you revert
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "actualEffort"`);
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "estimateEffort"`);
  }
}
