import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferenceFieldsToEmail1774400000000
  implements MigrationInterface
{
  name = 'AddReferenceFieldsToEmail1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email" ADD COLUMN IF NOT EXISTS "referenceId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "email" ADD COLUMN IF NOT EXISTS "referenceType" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_referenceId_referenceType"
       ON "email" ("referenceId", "referenceType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_email_referenceId_referenceType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email" DROP COLUMN IF EXISTS "referenceType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email" DROP COLUMN IF EXISTS "referenceId"`,
    );
  }
}

