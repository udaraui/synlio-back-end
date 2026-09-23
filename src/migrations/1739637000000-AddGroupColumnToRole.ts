import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupColumnToRole1739637000000 implements MigrationInterface {
  name = 'AddGroupColumnToRole1739637000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add group column to role table
    await queryRunner.query(`
      ALTER TABLE "role"
      ADD COLUMN "group" character varying
    `);

    // Create index on group for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_role_group" ON "role" ("group")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX "IDX_role_group"
    `);

    // Drop group column
    await queryRunner.query(`
      ALTER TABLE "role"
      DROP COLUMN "group"
    `);
  }
}
