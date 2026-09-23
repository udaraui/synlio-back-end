import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailConfigToTaskSpace1776200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_space"
        ADD COLUMN IF NOT EXISTS "notificationEmail" character varying,
        ADD COLUMN IF NOT EXISTS "emailProvider" character varying,
        ADD COLUMN IF NOT EXISTS "notificationEmailPassword" character varying;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "task_space"."emailProvider"
        IS 'SMTP provider used for outbound notifications';
      COMMENT ON COLUMN "task_space"."notificationEmailPassword"
        IS 'App password for SMTP auth';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task_space"
        DROP COLUMN IF EXISTS "notificationEmail",
        DROP COLUMN IF EXISTS "emailProvider",
        DROP COLUMN IF EXISTS "notificationEmailPassword";
    `);
  }
}
