import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHierarchyLevelSnapshotToTask1775600000000
  implements MigrationInterface
{
  name = 'AddHierarchyLevelSnapshotToTask1775600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD COLUMN IF NOT EXISTS "hierarchyLevelName"  varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "hierarchyLevelIcon"  varchar(100) NULL,
        ADD COLUMN IF NOT EXISTS "hierarchyLevelColor" varchar(50)  NULL
    `);

    // Back-fill existing rows from the related config record
    await queryRunner.query(`
      UPDATE "tm_task" t
      SET
        "hierarchyLevelName"  = c.name,
        "hierarchyLevelIcon"  = c.icon,
        "hierarchyLevelColor" = c.color
      FROM "task_space_hierarchy_level_config" c
      WHERE t."hierarchyLevelConfigId" = c.id
        AND t."hierarchyLevelConfigId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        DROP COLUMN IF EXISTS "hierarchyLevelName",
        DROP COLUMN IF EXISTS "hierarchyLevelIcon",
        DROP COLUMN IF EXISTS "hierarchyLevelColor"
    `);
  }
}

