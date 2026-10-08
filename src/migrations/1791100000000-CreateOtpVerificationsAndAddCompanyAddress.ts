import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpVerificationsAndAddCompanyAddress1791100000000 implements MigrationInterface {
  name = 'CreateOtpVerificationsAndAddCompanyAddress1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the existing user_temporary table
    await queryRunner.query(`DROP TABLE IF EXISTS "user_temporary"`);

    // 2. Create the new otp_verifications table
    await queryRunner.query(`
      CREATE TABLE "otp_verifications" (
        "id" SERIAL NOT NULL,
        "email" character varying NOT NULL,
        "hashed_otp" character varying NOT NULL,
        "expiry" TIMESTAMP NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_otp_verifications_email" UNIQUE ("email"),
        CONSTRAINT "PK_otp_verifications" PRIMARY KEY ("id")
      )
    `);

    // 3. Add address column to company table
    await queryRunner.query(`ALTER TABLE "company" ADD "address" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert company address
    await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "address"`);

    // Revert otp_verifications
    await queryRunner.query(`DROP TABLE "otp_verifications"`);

    // Recreate user_temporary table (best-effort matching the previous schema)
    await queryRunner.query(`
      CREATE TABLE "user_temporary" (
        "id" SERIAL NOT NULL,
        "first_name" character varying,
        "last_name" character varying,
        "email" character varying NOT NULL,
        "mobile_number" character varying,
        "password" character varying,
        "profile_picture" character varying,
        "emailVerificationToken" character varying NOT NULL,
        "emailVerificationTokenExpiry" TIMESTAMP NOT NULL,
        "verificationAttempts" integer NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_user_temporary_email" UNIQUE ("email"),
        CONSTRAINT "UQ_user_temporary_emailVerificationToken" UNIQUE ("emailVerificationToken"),
        CONSTRAINT "PK_user_temporary" PRIMARY KEY ("id")
      )
    `);
  }
}
