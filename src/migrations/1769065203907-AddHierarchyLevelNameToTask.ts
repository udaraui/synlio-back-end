import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHierarchyLevelNameToTask1769065203907
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add hierarchyLevelName column
    await queryRunner.query(`
            ALTER TABLE "task" 
            ADD COLUMN "hierarchyLevelName" VARCHAR
        `);

    // Populate hierarchyLevelName for existing tasks based on hierarchyLevel and project structure
    await queryRunner.query(`
            UPDATE "task" t
            SET "hierarchyLevelName" = subquery."levelName"
            FROM (
                SELECT 
                    t2.id as task_id,
                    COALESCE(pgsd.name, 'Level ' || CAST(t2."hierarchyLevel" AS VARCHAR)) as "levelName"
                FROM "task" t2
                LEFT JOIN "project_group" pg ON t2."projectGroupId" = pg.id
                LEFT JOIN "project_group_custom_structure" pgcs ON pgcs."projectGroupId" = pg.id
                LEFT JOIN "project_group_structure_dtl" pgsd 
                    ON pgsd.id = pgcs."dtlId"
                    AND pgsd.sequence = t2."hierarchyLevel"
                WHERE t2."hierarchyLevel" IS NOT NULL
            ) AS subquery
            WHERE t.id = subquery.task_id
        `);

    // Set default for tasks without hierarchyLevel
    await queryRunner.query(`
            UPDATE "task"
            SET "hierarchyLevelName" = 'Level 1'
            WHERE "hierarchyLevel" IS NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop hierarchyLevelName column
    await queryRunner.query(`
            ALTER TABLE "task" 
            DROP COLUMN "hierarchyLevelName"
        `);
  }
}
