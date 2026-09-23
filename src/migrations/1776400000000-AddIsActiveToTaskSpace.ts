import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsActiveToTaskSpace1776400000000 implements MigrationInterface {
  name = 'AddIsActiveToTaskSpace1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_space" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_space" DROP COLUMN IF EXISTS "isActive"`,
    );
  }
}

