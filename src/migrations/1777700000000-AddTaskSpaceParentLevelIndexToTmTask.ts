import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskSpaceParentLevelIndexToTmTask1777700000000
  implements MigrationInterface
{
  name = 'AddTaskSpaceParentLevelIndexToTmTask1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tm_task_spaceId_parentId_levelSeq"
      ON "tm_task" ("taskSpaceId", "parentTaskId", "hierarchyLevelSequence")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tm_task_spaceId_parentId_levelSeq"
    `);
  }
}
