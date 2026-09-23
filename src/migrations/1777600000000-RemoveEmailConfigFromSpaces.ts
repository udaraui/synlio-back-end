import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveEmailConfigFromSpaces1777600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove notification email config columns from task_space
    await queryRunner.query(`
      ALTER TABLE "task_space"
        DROP COLUMN IF EXISTS "notificationEmailPassword",
        DROP COLUMN IF EXISTS "emailProvider",
        DROP COLUMN IF EXISTS "notificationEmail";
    `);

    // Remove notification email config columns from ticket_space
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
        DROP COLUMN IF EXISTS "notificationEmailPassword",
        DROP COLUMN IF EXISTS "emailProvider",
        DROP COLUMN IF EXISTS "notificationEmail";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore columns in task_space
    await queryRunner.query(`
      ALTER TABLE "task_space"
        ADD COLUMN IF NOT EXISTS "notificationEmail" character varying,
        ADD COLUMN IF NOT EXISTS "emailProvider" character varying,
        ADD COLUMN IF NOT EXISTS "notificationEmailPassword" character varying;
    `);

    // Restore columns in ticket_space
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
        ADD COLUMN IF NOT EXISTS "notificationEmail" character varying,
        ADD COLUMN IF NOT EXISTS "emailProvider" character varying,
        ADD COLUMN IF NOT EXISTS "notificationEmailPassword" character varying;
    `);
  }
}
