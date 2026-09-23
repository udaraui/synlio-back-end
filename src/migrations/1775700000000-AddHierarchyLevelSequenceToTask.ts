import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHierarchyLevelSequenceToTask1775700000000
  implements MigrationInterface
{
  name = 'AddHierarchyLevelSequenceToTask1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        ADD COLUMN IF NOT EXISTS "hierarchyLevelSequence" int NULL
    `);

    // Back-fill existing rows from the related config record
    await queryRunner.query(`
      UPDATE "tm_task" t
      SET "hierarchyLevelSequence" = c.sequence
      FROM "task_space_hierarchy_level_config" c
      WHERE t."hierarchyLevelConfigId" = c.id
        AND t."hierarchyLevelConfigId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tm_task"
        DROP COLUMN IF EXISTS "hierarchyLevelSequence"
    `);
  }
}

