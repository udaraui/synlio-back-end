import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompositeIndexesToTmTask1777800000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tm_task_spaceId_parentId_levelSeq"
      ON "tm_task" ("taskSpaceId", "parentTaskId", "hierarchyLevelSequence")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tm_task_spaceId_parentId"
      ON "tm_task" ("taskSpaceId", "parentTaskId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tm_task_spaceId_parentId_levelSeq"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tm_task_spaceId_parentId"`,
    );
  }
}

