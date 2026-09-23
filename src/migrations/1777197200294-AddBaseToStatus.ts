import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBaseToStatus1777197200294 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the status_base_enum type if it doesn't already exist
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE status_base_enum AS ENUM ('To Start', 'Processing', 'Finished');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add base column to status table (nullable so existing rows are unaffected)
    await queryRunner.query(`
      ALTER TABLE "status"
      ADD COLUMN IF NOT EXISTS "base" status_base_enum NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "status" DROP COLUMN IF EXISTS "base";`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS status_base_enum;`);
  }
}
