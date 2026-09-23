import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeAssigneeNullable1736185000000 implements MigrationInterface {
  name = 'MakeAssigneeNullable1736185000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task" ALTER COLUMN "assigneeId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task" ALTER COLUMN "assigneeId" SET NOT NULL`,
    );
  }
}
