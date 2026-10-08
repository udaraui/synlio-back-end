import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a failed-attempt counter to `user_temporary` so 6-digit verification
 * codes can be locked after too many wrong guesses (brute-force protection).
 */
export class AddVerificationAttemptsToUserTemporary1790900000000
  implements MigrationInterface
{
  name = 'AddVerificationAttemptsToUserTemporary1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_temporary"
      ADD COLUMN IF NOT EXISTS "verificationAttempts" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_temporary"
      DROP COLUMN IF EXISTS "verificationAttempts"
    `);
  }
}
