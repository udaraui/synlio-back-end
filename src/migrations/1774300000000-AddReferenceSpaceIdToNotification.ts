import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferenceSpaceIdToNotification1774300000000
  implements MigrationInterface
{
  name = 'AddReferenceSpaceIdToNotification1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification"
      ADD COLUMN IF NOT EXISTS "referenceSpaceId" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification"
      DROP COLUMN IF EXISTS "referenceSpaceId"
    `);
  }
}
