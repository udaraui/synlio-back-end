import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the simple many-to-many join table (task_space_hierarchy_level_map)
 * with a richer config table that allows per-space overrides of name / icon / color.
 *
 * Master data in task_space_hierarchy_level is NEVER modified.
 */
export class CreateTaskSpaceHierarchyLevelConfig1775200000000
  implements MigrationInterface
{
  name = 'CreateTaskSpaceHierarchyLevelConfig1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Create the new config table ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_space_hierarchy_level_config" (
        "id"               SERIAL                   NOT NULL,
        "createdAt"        TIMESTAMP                NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP                NOT NULL DEFAULT now(),
        "createdBy"        character varying(50),
        "updatedBy"        character varying(50),
        "taskSpaceId"      integer                  NOT NULL,
        "hierarchyLevelId" integer                  NOT NULL,
        "sequence"         integer                  NOT NULL DEFAULT 0,
        "name"             character varying(255),
        "icon"             character varying(100),
        "color"            character varying(50),
        CONSTRAINT "PK_task_space_hierarchy_level_config"
          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ts_hl_config_space_level"
          UNIQUE ("taskSpaceId", "hierarchyLevelId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ts_hl_config_taskSpaceId"
        ON "task_space_hierarchy_level_config" ("taskSpaceId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ts_hl_config_hierarchyLevelId"
        ON "task_space_hierarchy_level_config" ("hierarchyLevelId")
    `);

    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        ADD CONSTRAINT "FK_ts_hl_config_taskSpace"
        FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_config"
        ADD CONSTRAINT "FK_ts_hl_config_hierarchyLevel"
        FOREIGN KEY ("hierarchyLevelId") REFERENCES "task_space_hierarchy_level"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // ── 2. Migrate existing map rows → config rows (with no overrides) ──
    await queryRunner.query(`
      INSERT INTO "task_space_hierarchy_level_config"
        ("taskSpaceId", "hierarchyLevelId", "sequence")
      SELECT
        m."taskSpaceId",
        m."hierarchyLevelId",
        ROW_NUMBER() OVER (
          PARTITION BY m."taskSpaceId"
          ORDER BY hl."sequence" ASC, m."hierarchyLevelId" ASC
        ) - 1   AS "sequence"
      FROM "task_space_hierarchy_level_map" m
      JOIN "task_space_hierarchy_level" hl ON hl.id = m."hierarchyLevelId"
    `);

    // ── 3. Drop the old join table ───────────────────────────────────────
    await queryRunner.query(`
      DROP TABLE IF EXISTS "task_space_hierarchy_level_map"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Recreate the old join table ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "task_space_hierarchy_level_map" (
        "taskSpaceId"      integer NOT NULL,
        "hierarchyLevelId" integer NOT NULL,
        CONSTRAINT "PK_task_space_hierarchy_level_map"
          PRIMARY KEY ("taskSpaceId", "hierarchyLevelId")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_map"
        ADD CONSTRAINT "FK_ts_hl_map_taskSpace"
        FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_hierarchy_level_map"
        ADD CONSTRAINT "FK_ts_hl_map_hierarchyLevel"
        FOREIGN KEY ("hierarchyLevelId") REFERENCES "task_space_hierarchy_level"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // ── 2. Restore rows from config table ───────────────────────────────
    await queryRunner.query(`
      INSERT INTO "task_space_hierarchy_level_map" ("taskSpaceId", "hierarchyLevelId")
      SELECT "taskSpaceId", "hierarchyLevelId"
      FROM "task_space_hierarchy_level_config"
    `);

    // ── 3. Drop the config table ─────────────────────────────────────────
    await queryRunner.query(
      `DROP TABLE IF EXISTS "task_space_hierarchy_level_config"`,
    );
  }
}
