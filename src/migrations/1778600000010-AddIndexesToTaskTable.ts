import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesToTaskTable1778600000010
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_task_companyId_taskSpaceId_parentTaskId_hierarchyLevelSequence" ON "tm_task" ("companyId", "taskSpaceId", "parentTaskId", "hierarchyLevelSequence") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_companyId_taskSpaceId_parentTaskId" ON "tm_task" ("companyId", "taskSpaceId", "parentTaskId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_task_companyId_taskSpaceId_parentTaskId_hierarchyLevelSequence"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_task_companyId_taskSpaceId_parentTaskId"`,
    );
  }
}