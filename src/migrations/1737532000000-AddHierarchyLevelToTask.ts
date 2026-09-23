import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHierarchyLevelToTask1737532000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add hierarchyLevel column to task table
    await queryRunner.query(`
      ALTER TABLE "task" 
      ADD COLUMN "hierarchyLevel" integer
    `);

    // Set hierarchyLevel = 1 for all tasks where isProject = true (existing projects)
    await queryRunner.query(`
      UPDATE "task" 
      SET "hierarchyLevel" = 1 
      WHERE "isProject" = true
    `);

    // Set hierarchyLevel = 2 for all tasks where isProject = false (existing tasks)
    await queryRunner.query(`
      UPDATE "task" 
      SET "hierarchyLevel" = 2 
      WHERE "isProject" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop hierarchyLevel column
    await queryRunner.query(`
      ALTER TABLE "task" 
      DROP COLUMN "hierarchyLevel"
    `);
  }
}
