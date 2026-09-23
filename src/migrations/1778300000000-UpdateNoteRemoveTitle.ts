import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema changes for the note feature:
 *  1. Drop `title` column (not needed — content only)
 *  2. Make `companyId` nullable (no NOT NULL constraint)
 *  3. Make `ownerId`  nullable (defensive — consistent with entity)
 */
export class UpdateNoteRemoveTitle1778300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop title column
    await queryRunner.query(`
      ALTER TABLE "note"
        DROP COLUMN IF EXISTS "title"
    `);

    // 2. Make companyId nullable (was NOT NULL — caused the null constraint error)
    await queryRunner.query(`
      ALTER TABLE "note"
        ALTER COLUMN "companyId" DROP NOT NULL
    `);

    // 3. Make ownerId nullable (consistent with entity declaration)
    await queryRunner.query(`
      ALTER TABLE "note"
        ALTER COLUMN "ownerId" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore NOT NULL constraints
    await queryRunner.query(`
      ALTER TABLE "note"
        ALTER COLUMN "ownerId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "note"
        ALTER COLUMN "companyId" SET NOT NULL
    `);

    // Re-add title column
    await queryRunner.query(`
      ALTER TABLE "note"
        ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) NOT NULL DEFAULT ''
    `);
  }
}

