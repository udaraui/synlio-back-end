import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegistrationAndVerification1790200000000
  implements MigrationInterface
{
  name = 'AddRegistrationAndVerification1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // User table: self-registration flag
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "is_self_registered_user" boolean NOT NULL DEFAULT false
    `);

    // User table: email verification flag
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean NOT NULL DEFAULT false
    `);

    // User table: email verification token
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying DEFAULT NULL
    `);

    // User table: email verification token expiry
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpiry" TIMESTAMP DEFAULT NULL
    `);

    // Company table: self-registration flag
    await queryRunner.query(`
      ALTER TABLE "company"
      ADD COLUMN IF NOT EXISTS "is_self_registered_company" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company"
      DROP COLUMN IF EXISTS "is_self_registered_company"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "emailVerificationTokenExpiry"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "emailVerificationToken"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "isEmailVerified"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "is_self_registered_user"
    `);
  }
}
