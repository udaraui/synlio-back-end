import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkTypeTargetName1785100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Reciprocal display name on link_type (e.g. "Blocks" -> targetName "Depends On").
    await queryRunner.query(
      `ALTER TABLE "link_type" ADD COLUMN IF NOT EXISTS "targetName" varchar`,
    );

    // 2. Denormalized reciprocal name on work_item_link, captured at link time.
    await queryRunner.query(
      `ALTER TABLE "work_item_link" ADD COLUMN IF NOT EXISTS "linkTargetTypeName" varchar`,
    );

    // Seed the reciprocal pair for the default Block/Depend types. Different
    // environments have ended up with different naming ("Block" vs "Blocks",
    // "Depend" vs "Depends On") after manual renames, so match both forms.
    await queryRunner.query(`
      UPDATE "link_type" SET "targetName" = CASE "name"
        WHEN 'Block' THEN 'Depend'
        WHEN 'Blocks' THEN 'Depends On'
        WHEN 'Depend' THEN 'Block'
        WHEN 'Depends On' THEN 'Blocks'
      END
      WHERE "name" IN ('Block', 'Blocks', 'Depend', 'Depends On')
    `);

    // Backfill existing links: source side keeps linkTypeName, target side
    // gets the reciprocal name (falls back to the same name when unset).
    await queryRunner.query(`
      UPDATE "work_item_link" wl
         SET "linkTargetTypeName" = COALESCE(lt."targetName", lt."name")
        FROM "link_type" lt
       WHERE wl."linkTypeId" = lt."id"
         AND wl."linkTargetTypeName" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_item_link" DROP COLUMN IF EXISTS "linkTargetTypeName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_type" DROP COLUMN IF EXISTS "targetName"`,
    );
  }
}
