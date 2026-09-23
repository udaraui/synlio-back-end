import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHierarchyLevelConfigToTask1775500000000
  implements MigrationInterface
{
  name = 'AddHierarchyLevelConfigToTask1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add hierarchyLevelConfigId column to tm_task
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD COLUMN IF NOT EXISTS "hierarchyLevelConfigId" integer
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD CONSTRAINT "FK_tm_task_hierarchyLevelConfig"
        FOREIGN KEY ("hierarchyLevelConfigId")
        REFERENCES "task_space_hierarchy_level_config"("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION
    `);

    // Add index for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_tm_task_hierarchyLevelConfigId"
        ON "tm_task" ("hierarchyLevelConfigId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tm_task_hierarchyLevelConfigId"
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        DROP CONSTRAINT IF EXISTS "FK_tm_task_hierarchyLevelConfig"
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        DROP COLUMN IF EXISTS "hierarchyLevelConfigId"
    `);
  }
}

