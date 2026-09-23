import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectGroupIdToTask1734960000000
  implements MigrationInterface
{
  name = 'AddProjectGroupIdToTask1734960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the old many-to-many join table between task and project_group if it exists
    await queryRunner.query(`
            DROP TABLE IF EXISTS "project_group_tasks" CASCADE
        `);

    // 2. Add projectGroupId column to task table (nullable first for migration)
    await queryRunner.query(`
            ALTER TABLE "task" 
            ADD COLUMN IF NOT EXISTS "projectGroupId" integer
        `);

    // 3. For existing tasks without a projectGroup, set a default projectGroupId
    // You may want to update this query based on your business logic
    await queryRunner.query(`
            UPDATE "task" 
            SET "projectGroupId" = (
                SELECT id FROM "project_group" LIMIT 1
            )
            WHERE "projectGroupId" IS NULL
        `);

    // 4. Now make projectGroupId NOT NULL
    await queryRunner.query(`
            ALTER TABLE "task" 
            ALTER COLUMN "projectGroupId" SET NOT NULL
        `);

    // 5. Add foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "task" 
            ADD CONSTRAINT "FK_task_projectGroupId" 
            FOREIGN KEY ("projectGroupId") 
            REFERENCES "project_group"("id") 
            ON DELETE RESTRICT 
            ON UPDATE NO ACTION
        `);

    // 6. Add index for better query performance
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_task_projectGroupId" 
            ON "task" ("projectGroupId")
        `);

    // 7. Add companyId and divisionId to task if they don't exist (they may be derived from projectGroup)
    await queryRunner.query(`
            ALTER TABLE "task" 
            ADD COLUMN IF NOT EXISTS "companyId" integer
        `);

    await queryRunner.query(`
            ALTER TABLE "task" 
            ADD COLUMN IF NOT EXISTS "divisionId" integer
        `);

    // 8. Update companyId and divisionId from the projectGroup
    await queryRunner.query(`
            UPDATE "task" t
            SET "companyId" = pg."companyId",
                "divisionId" = pg."divisionId"
            FROM "project_group" pg
            WHERE t."projectGroupId" = pg.id
        `);

    // 9. Add foreign key constraints for companyId and divisionId
    await queryRunner.query(`
            ALTER TABLE "task" 
            ADD CONSTRAINT "FK_task_companyId" 
            FOREIGN KEY ("companyId") 
            REFERENCES "company"("id") 
            ON DELETE RESTRICT 
            ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "task" 
            ADD CONSTRAINT "FK_task_divisionId" 
            FOREIGN KEY ("divisionId") 
            REFERENCES "division"("id") 
            ON DELETE SET NULL 
            ON UPDATE NO ACTION
        `);

    // console.log('Migration completed: AddProjectGroupIdToTask');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "task" 
            DROP CONSTRAINT IF EXISTS "FK_task_divisionId"
        `);

    await queryRunner.query(`
            ALTER TABLE "task" 
            DROP CONSTRAINT IF EXISTS "FK_task_companyId"
        `);

    // 2. Drop companyId and divisionId columns
    await queryRunner.query(`
            ALTER TABLE "task" 
            DROP COLUMN IF EXISTS "divisionId"
        `);

    await queryRunner.query(`
            ALTER TABLE "task" 
            DROP COLUMN IF EXISTS "companyId"
        `);

    // 3. Drop index
    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_task_projectGroupId"
        `);

    // 4. Drop foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "task" 
            DROP CONSTRAINT IF EXISTS "FK_task_projectGroupId"
        `);

    // 5. Drop projectGroupId column
    await queryRunner.query(`
            ALTER TABLE "task" 
            DROP COLUMN IF EXISTS "projectGroupId"
        `);

    // 6. Recreate the many-to-many join table
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "project_group_tasks" (
                "projectGroupId" integer NOT NULL,
                "taskId" integer NOT NULL,
                CONSTRAINT "PK_project_group_tasks" PRIMARY KEY ("projectGroupId", "taskId")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_project_group_tasks_projectGroupId" 
            ON "project_group_tasks" ("projectGroupId")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_project_group_tasks_taskId" 
            ON "project_group_tasks" ("taskId")
        `);

    await queryRunner.query(`
            ALTER TABLE "project_group_tasks" 
            ADD CONSTRAINT "FK_project_group_tasks_projectGroupId" 
            FOREIGN KEY ("projectGroupId") 
            REFERENCES "project_group"("id") 
            ON DELETE CASCADE 
            ON UPDATE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "project_group_tasks" 
            ADD CONSTRAINT "FK_project_group_tasks_taskId" 
            FOREIGN KEY ("taskId") 
            REFERENCES "task"("id") 
            ON DELETE CASCADE 
            ON UPDATE CASCADE
        `);

    // console.log('Migration reverted: AddProjectGroupIdToTask');
  }
}
