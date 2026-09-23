import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailConfigToTicketSpace1774100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
        ADD COLUMN IF NOT EXISTS "notificationEmail" character varying,
        ADD COLUMN IF NOT EXISTS "emailProvider" character varying,
        ADD COLUMN IF NOT EXISTS "notificationEmailPassword" character varying;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "ticket_space"."emailProvider"
        IS 'SMTP provider used for outbound notifications';
      COMMENT ON COLUMN "ticket_space"."notificationEmailPassword"
        IS 'App password for SMTP auth';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
        DROP COLUMN IF EXISTS "notificationEmail",
        DROP COLUMN IF EXISTS "emailProvider",
        DROP COLUMN IF EXISTS "notificationEmailPassword";
    `);
  }
}
