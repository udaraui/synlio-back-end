import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTemporaryAndRegistrationSource1790200000001
  implements MigrationInterface
{
  name = 'AddUserTemporaryAndRegistrationSource1790200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Create user_temporary table ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_temporary" (
        "id"                           SERIAL PRIMARY KEY,
        "first_name"                   character varying NOT NULL,
        "last_name"                    character varying NOT NULL,
        "email"                        character varying NOT NULL,
        "mobile_number"                character varying DEFAULT NULL,
        "password"                     character varying NOT NULL,
        "emailVerificationToken"       character varying NOT NULL,
        "emailVerificationTokenExpiry" TIMESTAMP NOT NULL,
        "created_at"                   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_temporary_email"  UNIQUE ("email"),
        CONSTRAINT "UQ_user_temporary_token"  UNIQUE ("emailVerificationToken")
      )
    `);

    // ── 2. Drop old email-verification columns from user ────────────────────
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "isEmailVerified"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "emailVerificationToken"
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "emailVerificationTokenExpiry"
    `);

    // ── 3. Drop old boolean self-registration flag ───────────────────────────
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "is_self_registered_user"
    `);

    // ── 4. Create the enum type and add registrationSource column ────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."user_registrationsource_enum"
          AS ENUM ('system', 'bulk', 'self_registered');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "registrationSource"
        "public"."user_registrationsource_enum"
        NOT NULL DEFAULT 'system'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Reverse 4: remove registrationSource column and enum ─────────────────
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "registrationSource"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."user_registrationsource_enum"
    `);

    // ── Reverse 3: restore boolean self-registration flag ────────────────────
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "is_self_registered_user" boolean NOT NULL DEFAULT false
    `);

    // ── Reverse 2: restore email-verification columns on user ────────────────
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpiry" TIMESTAMP DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean NOT NULL DEFAULT false
    `);

    // ── Reverse 1: drop user_temporary table ─────────────────────────────────
    await queryRunner.query(`
      DROP TABLE IF EXISTS "user_temporary"
    `);
  }
}
