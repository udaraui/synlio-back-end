import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferenceFieldsToNotification1774200000000
  implements MigrationInterface
{
  name = 'AddReferenceFieldsToNotification1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification"
      ADD COLUMN IF NOT EXISTS "referenceId"      integer,
      ADD COLUMN IF NOT EXISTS "referenceType"    character varying
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notification_referenceId" ON "notification" ("referenceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notification_referenceType" ON "notification" ("referenceType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_referenceType"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notification_referenceId"`,
    );
    await queryRunner.query(`
      ALTER TABLE "notification"
      DROP COLUMN IF EXISTS "referenceId",
      DROP COLUMN IF EXISTS "referenceType"
    `);
  }
}
