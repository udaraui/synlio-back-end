import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveHierarchyLevelNameFromTask1769067201205
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop hierarchyLevelName column
    await queryRunner.query(`
            ALTER TABLE "task" 
            DROP COLUMN IF EXISTS "hierarchyLevelName"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add hierarchyLevelName column back
    await queryRunner.query(`
            ALTER TABLE "task" 
            ADD COLUMN "hierarchyLevelName" VARCHAR
        `);

    // Populate it for existing tasks
    await queryRunner.query(`
            UPDATE "task" t
            SET "hierarchyLevelName" = COALESCE(pgsd.name, 'Level ' || t."hierarchyLevel")
            FROM "project_group" pg
            LEFT JOIN "project_group_structure_dtl" pgsd 
                ON pgsd."projectGroupId" = pg.id 
                AND pgsd.sequence = t."hierarchyLevel"
            WHERE t."projectGroupId" = pg.id
                AND t."hierarchyLevel" IS NOT NULL
        `);
  }
}
