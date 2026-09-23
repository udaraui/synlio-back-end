import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures the note_shared_users ManyToMany join table exists.
 * Safe to run even if note table already exists.
 */
export class CreateNoteSharedUsersTable1778400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create note table if it doesn't exist yet (idempotent)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "note" (
        "id"          SERIAL PRIMARY KEY,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdBy"   VARCHAR(50),
        "updatedBy"   VARCHAR(50),
        "content"     TEXT,
        "ownerId"     INTEGER,
        "companyId"   INTEGER,
        CONSTRAINT "FK_note_owner" FOREIGN KEY ("ownerId")
          REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    // Drop title column if it still exists (from older schema)
    await queryRunner.query(`
      ALTER TABLE "note" DROP COLUMN IF EXISTS "title"
    `);

    // Make companyId / ownerId nullable if they aren't already
    await queryRunner.query(`
      ALTER TABLE "note"
        ALTER COLUMN "companyId" DROP NOT NULL,
        ALTER COLUMN "ownerId"   DROP NOT NULL
    `);

    // Create the ManyToMany join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "note_shared_users" (
        "noteId"  INTEGER NOT NULL,
        "userId"  INTEGER NOT NULL,
        PRIMARY KEY ("noteId", "userId"),
        CONSTRAINT "FK_note_shared_users_note" FOREIGN KEY ("noteId")
          REFERENCES "note"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_note_shared_users_user" FOREIGN KEY ("userId")
          REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_note_shared_users_userId"
      ON "note_shared_users" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_note_ownerId_companyId"
      ON "note" ("ownerId", "companyId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_note_shared_users_userId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "note_shared_users"`);
  }
}

