import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkTypeDescriptionAndLinkTypeName1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Optional description on link_type explaining its purpose/usage.
    await queryRunner.query(
      `ALTER TABLE "link_type" ADD COLUMN IF NOT EXISTS "description" text`,
    );

    // 2. Optional denormalized link type name on work_item_link.
    await queryRunner.query(
      `ALTER TABLE "work_item_link" ADD COLUMN IF NOT EXISTS "linkTypeName" varchar`,
    );

    // Backfill existing links with their current link type name.
    await queryRunner.query(`
      UPDATE "work_item_link" wl
         SET "linkTypeName" = lt."name"
        FROM "link_type" lt
       WHERE wl."linkTypeId" = lt."id"
         AND wl."linkTypeName" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_item_link" DROP COLUMN IF EXISTS "linkTypeName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_type" DROP COLUMN IF EXISTS "description"`,
    );
  }
}
