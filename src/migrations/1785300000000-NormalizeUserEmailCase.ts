import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeUserEmailCase1785300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres compares strings case-sensitively, so the plain unique
    // constraint on "email" allowed "Mayura@gmail.com" and "mayura@gmail.com"
    // to exist as two separate accounts. Emails are now stored lowercased and
    // the uniqueness is enforced on the normalized value.

    // 1. Refuse to run if the data already contains case-duplicate accounts —
    //    merging them means reassigning tasks, tickets, roles and resources,
    //    which is a decision for an operator, not a schema migration.
    const collisions: Array<{ email: string; ids: string }> =
      await queryRunner.query(`
        SELECT LOWER(TRIM("email")) AS email,
               STRING_AGG("id"::text, ', ' ORDER BY "id") AS ids
          FROM "user"
         GROUP BY LOWER(TRIM("email"))
        HAVING COUNT(*) > 1
      `);

    if (collisions.length > 0) {
      const detail = collisions
        .map((c) => `  ${c.email} -> user ids ${c.ids}`)
        .join('\n');
      throw new Error(
        'Cannot normalize user emails: the following addresses already exist ' +
          'under multiple accounts. Merge or deactivate the duplicates, then ' +
          're-run the migration.\n' +
          detail,
      );
    }

    // 2. Backfill existing rows to the canonical form.
    await queryRunner.query(
      `UPDATE "user" SET "email" = LOWER(TRIM("email")) WHERE "email" <> LOWER(TRIM("email"))`,
    );

    // 3. Keep the resource mirror of the address in sync — it is joined to
    //    "user"."email" in several places (see create-missing-resources.sql).
    await queryRunner.query(
      `UPDATE "resource" SET "email" = LOWER(TRIM("email")) WHERE "email" IS NOT NULL AND "email" <> LOWER(TRIM("email"))`,
    );

    // 4. Backstop the application-level normalization at the DB level, so any
    //    write path that forgets to normalize cannot reintroduce a duplicate.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_email_lower" ON "user" (LOWER("email"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The lowercasing itself is not reversible — original casing is not stored.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "unique_user_email_lower"`,
    );
  }
}
