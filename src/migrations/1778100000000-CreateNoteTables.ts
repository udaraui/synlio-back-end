import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNoteTables1778100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create note table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "note" (
        "id"          SERIAL PRIMARY KEY,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdBy"   VARCHAR(50),
        "updatedBy"   VARCHAR(50),
        "title"       VARCHAR(255) NOT NULL,
        "content"     TEXT,
        "ownerId"     INTEGER NOT NULL,
        "companyId"   INTEGER NOT NULL,
        CONSTRAINT "FK_note_owner" FOREIGN KEY ("ownerId")
          REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_note_ownerId_companyId"
      ON "note" ("ownerId", "companyId")
    `);

    // ManyToMany join table: note <-> user (shared users)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "note_shared_users" (
        "noteId"   INTEGER NOT NULL,
        "userId"   INTEGER NOT NULL,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_note_shared_users_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "note_shared_users"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_note_ownerId_companyId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "note"`);
  }
}
