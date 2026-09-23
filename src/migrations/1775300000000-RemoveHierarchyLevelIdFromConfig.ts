import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the `hierarchyLevelId` FK from `task_space_hierarchy_level_config`.
 *
 * Before dropping the column we copy the resolved name / icon / color
 * from the master table into every config row that still has nulls,
 * so no data is lost.
 */
export class RemoveHierarchyLevelIdFromConfig1775300000000
  implements MigrationInterface
{
  name = 'RemoveHierarchyLevelIdFromConfig1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Resolve any remaining null name / icon / color from master ────
    await queryRunner.query(`
      UPDATE "task_space_hierarchy_level_config" c
      SET
        "name"  = COALESCE(c."name",  hl."name"),
        "icon"  = COALESCE(c."icon",  hl."icon",  'Folder'),
        "color" = COALESCE(c."color", hl."color", '#6366f1')
      FROM "task_space_hierarchy_level" hl
      WHERE c."hierarchyLevelId" = hl."id"
    `);

    // ── 2. Drop FK constraint ────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        DROP CONSTRAINT IF EXISTS "FK_ts_hl_config_hierarchyLevel"
    `);

    // ── 3. Drop unique constraint that referenced hierarchyLevelId ───────
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        DROP CONSTRAINT IF EXISTS "UQ_ts_hl_config_space_level"
    `);

    // ── 4. Drop index on hierarchyLevelId ────────────────────────────────
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ts_hl_config_hierarchyLevelId"
    `);

    // ── 5. Drop the column ────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        DROP COLUMN IF EXISTS "hierarchyLevelId"
    `);

    // ── 6. Make name NOT NULL (all rows should now have a value) ─────────
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        ALTER COLUMN "name" SET NOT NULL
    `);

    // ── 7. Set defaults for icon / color columns ─────────────────────────
    await queryRunner.query(`
      UPDATE "task_space_hierarchy_level_config"
      SET "icon"  = 'Folder'    WHERE "icon"  IS NULL
    `);
    await queryRunner.query(`
      UPDATE "task_space_hierarchy_level_config"
      SET "color" = '#6366f1'   WHERE "color" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        ALTER COLUMN "icon"  SET NOT NULL,
        ALTER COLUMN "icon"  SET DEFAULT 'Folder',
        ALTER COLUMN "color" SET NOT NULL,
        ALTER COLUMN "color" SET DEFAULT '#6366f1'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the column as nullable (data loss of original FK is acceptable on rollback)
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        ADD COLUMN "hierarchyLevelId" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        ALTER COLUMN "name"  DROP NOT NULL,
        ALTER COLUMN "icon"  DROP NOT NULL,
        ALTER COLUMN "icon"  DROP DEFAULT,
        ALTER COLUMN "color" DROP NOT NULL,
        ALTER COLUMN "color" DROP DEFAULT
    `);
  }
}
