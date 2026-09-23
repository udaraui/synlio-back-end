import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the old `note_share` table created by the two-entity approach.
 * The new design uses a single `note` entity with a ManyToMany relation
 * to `user`, managed via the `note_shared_users` join table
 * (already created in migration 1778100000000).
 */
export class DropNoteShareTable1778200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old note_share table if it still exists
    await queryRunner.query(`
      DROP TABLE IF EXISTS "note_share" CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore note_share table if reverting
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "note_share" (
        "id"                SERIAL PRIMARY KEY,
        "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdBy"         VARCHAR(50),
        "updatedBy"         VARCHAR(50),
        "noteId"            INTEGER NOT NULL,
        "sharedWithUserId"  INTEGER NOT NULL,
        CONSTRAINT "unique_note_share" UNIQUE ("noteId", "sharedWithUserId"),
        CONSTRAINT "FK_note_share_note" FOREIGN KEY ("noteId")
          REFERENCES "note"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_note_share_user" FOREIGN KEY ("sharedWithUserId")
          REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
  }
}

