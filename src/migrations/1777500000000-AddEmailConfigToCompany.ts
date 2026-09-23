import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailConfigToCompany1777500000000 implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'company_emailprovider_enum'
        ) THEN
          CREATE TYPE "company_emailprovider_enum"
            AS ENUM ('gmail', 'outlook', 'mail_service');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "company"
        ADD COLUMN IF NOT EXISTS "notificationEmail" character varying,
        ADD COLUMN IF NOT EXISTS "emailProvider" "company_emailprovider_enum",
        ADD COLUMN IF NOT EXISTS "notificationEmailPassword" character varying;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "company"."emailProvider"
        IS 'SMTP provider used for outbound notifications';
      COMMENT ON COLUMN "company"."notificationEmailPassword"
        IS 'App password / API key for SMTP auth';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company"
        DROP COLUMN IF EXISTS "notificationEmailPassword",
        DROP COLUMN IF EXISTS "emailProvider",
        DROP COLUMN IF EXISTS "notificationEmail";
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "company_emailprovider_enum";
    `);
  }
}
