import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class UpdateCommentUserDenormalization1792500000000
  implements MigrationInterface
{
  name = 'UpdateCommentUserDenormalization1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the new denormalized columns as nullable first
    await queryRunner.addColumns('comment', [
      new TableColumn({
        name: 'userId',
        type: 'integer',
        isNullable: true,
      }),
      new TableColumn({
        name: 'userEmail',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'username',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'profilePicture',
        type: 'text',
        isNullable: true,
      }),
    ]);

    // 2. Backfill existing comments from the "user" table matching comment."createdBy" = user.email
    await queryRunner.query(`
      UPDATE "comment" c
      SET
        "userId" = u.id,
        "userEmail" = u.email,
        "username" = TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))),
        "profilePicture" = u.profile_picture
      FROM "user" u
      WHERE LOWER(c."createdBy") = LOWER(u.email)
    `);

    // Fallback for any orphaned comments where createdBy does not match an existing user row
    await queryRunner.query(`
      UPDATE "comment"
      SET
        "userId" = COALESCE("userId", 0),
        "userEmail" = COALESCE("userEmail", "createdBy", 'unknown@system.local'),
        "username" = COALESCE(NULLIF("username", ''), "createdBy", 'Unknown User')
      WHERE "userId" IS NULL OR "userEmail" IS NULL OR "username" IS NULL OR "username" = ''
    `);

    // 3. Make userId, userEmail, and username NOT NULL (profilePicture remains nullable)
    await queryRunner.query(`
      ALTER TABLE "comment"
        ALTER COLUMN "userId" SET NOT NULL,
        ALTER COLUMN "userEmail" SET NOT NULL,
        ALTER COLUMN "username" SET NOT NULL
    `);

    // 4. Create index on userId for fast background profile sync updates
    await queryRunner.createIndex(
      'comment',
      new TableIndex({
        name: 'IDX_comment_userId',
        columnNames: ['userId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('comment', 'IDX_comment_userId');
    await queryRunner.dropColumns('comment', [
      'profilePicture',
      'username',
      'userEmail',
      'userId',
    ]);
  }
}

