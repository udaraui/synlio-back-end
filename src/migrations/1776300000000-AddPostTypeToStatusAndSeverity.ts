import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostTypeToStatusAndSeverity1776300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the post_type enum type if it doesn't already exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE post_type_enum AS ENUM ('Task', 'Ticket');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add postType column to status (nullable so existing rows are unaffected)
    await queryRunner.query(`
      ALTER TABLE "status"
      ADD COLUMN IF NOT EXISTS "postType" post_type_enum NULL;
    `);

    // Add postType column to severity (nullable so existing rows are unaffected)
    await queryRunner.query(`
      ALTER TABLE "severity"
      ADD COLUMN IF NOT EXISTS "postType" post_type_enum NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "severity" DROP COLUMN IF EXISTS "postType";`);
    await queryRunner.query(`ALTER TABLE "status" DROP COLUMN IF EXISTS "postType";`);
  }
}

