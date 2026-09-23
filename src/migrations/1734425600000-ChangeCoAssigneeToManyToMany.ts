import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTaskStructure1734425600000 implements MigrationInterface {
  name = 'UpdateTaskStructure1734425600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop old coAssigneeId foreign key constraint if it exists
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_coAssigneeId'
                ) THEN
                    ALTER TABLE "task" DROP CONSTRAINT "FK_task_coAssigneeId";
                END IF;
            END $$;
        `);

    // 2. Drop old coAssigneeId column if it exists
    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "coAssigneeId"
        `);

    // 3. Drop projectId foreign key constraint if it exists
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_projectId'
                ) THEN
                    ALTER TABLE "task" DROP CONSTRAINT "FK_task_projectId";
                END IF;
            END $$;
        `);

    // 4. Drop projectId column if it exists
    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "projectId"
        `);

    // 5. Drop isMiniProject column if it exists
    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "isMiniProject"
        `);

    // 6. Add new columns
    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "startDate" date
        `);

    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "isProject" boolean NOT NULL DEFAULT false
        `);

    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "parentTaskId" integer
        `);

    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "taskTypeId" integer
        `);

    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "taskTypeName" character varying
        `);

    // 7. Add companyId and divisionId columns if they don't exist
    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "companyId" integer
        `);

    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "divisionId" integer
        `);

    // 8. Make companyId nullable (in case it was NOT NULL before)
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'task' 
                    AND column_name = 'companyId' 
                    AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE "task" ALTER COLUMN "companyId" DROP NOT NULL;
                END IF;
            END $$;
        `);

    // 9. Drop projectGroupId foreign key if exists
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_projectGroupId'
                ) THEN
                    ALTER TABLE "task" DROP CONSTRAINT "FK_task_projectGroupId";
                END IF;
            END $$;
        `);

    // 10. Drop projectGroupId column if exists
    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "projectGroupId"
        `);

    // 11. Create the task_co_assignees join table
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "task_co_assignees" (
                "taskId" integer NOT NULL,
                "resourceId" integer NOT NULL,
                CONSTRAINT "PK_task_co_assignees" PRIMARY KEY ("taskId", "resourceId")
            )
        `);

    // 12. Create the project_group_tasks join table
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "project_group_tasks" (
                "projectGroupId" integer NOT NULL,
                "taskId" integer NOT NULL,
                CONSTRAINT "PK_project_group_tasks" PRIMARY KEY ("projectGroupId", "taskId")
            )
        `);

    // 13. Create indexes for the join tables
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_task_co_assignees_taskId" ON "task_co_assignees" ("taskId")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_task_co_assignees_resourceId" ON "task_co_assignees" ("resourceId")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_project_group_tasks_projectGroupId" ON "project_group_tasks" ("projectGroupId")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_project_group_tasks_taskId" ON "project_group_tasks" ("taskId")
        `);

    // 14. Add foreign key constraints for task_co_assignees
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_co_assignees_taskId'
                ) THEN
                    ALTER TABLE "task_co_assignees"
                    ADD CONSTRAINT "FK_task_co_assignees_taskId"
                    FOREIGN KEY ("taskId")
                    REFERENCES "task"("id")
                    ON DELETE CASCADE
                    ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_co_assignees_resourceId'
                ) THEN
                    ALTER TABLE "task_co_assignees"
                    ADD CONSTRAINT "FK_task_co_assignees_resourceId"
                    FOREIGN KEY ("resourceId")
                    REFERENCES "resource"("id")
                    ON DELETE CASCADE
                    ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

    // 14. Add foreign key constraints for project_group_tasks
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_project_group_tasks_projectGroupId'
                ) THEN
                    ALTER TABLE "project_group_tasks"
                    ADD CONSTRAINT "FK_project_group_tasks_projectGroupId"
                    FOREIGN KEY ("projectGroupId")
                    REFERENCES "project_group"("id")
                    ON DELETE CASCADE
                    ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_project_group_tasks_taskId'
                ) THEN
                    ALTER TABLE "project_group_tasks"
                    ADD CONSTRAINT "FK_project_group_tasks_taskId"
                    FOREIGN KEY ("taskId")
                    REFERENCES "task"("id")
                    ON DELETE CASCADE
                    ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

    // 15. Add foreign key for parentTaskId (self-referencing)
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_parentTaskId'
                ) THEN
                    ALTER TABLE "task"
                    ADD CONSTRAINT "FK_task_parentTaskId"
                    FOREIGN KEY ("parentTaskId")
                    REFERENCES "task"("id")
                    ON DELETE SET NULL
                    ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

    // 16. Add foreign key for taskTypeId
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_taskTypeId'
                ) THEN
                    ALTER TABLE "task"
                    ADD CONSTRAINT "FK_task_taskTypeId"
                    FOREIGN KEY ("taskTypeId")
                    REFERENCES "task_type"("id")
                    ON DELETE SET NULL
                    ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

    // 17. Create indexes for better performance
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_task_parentTaskId" ON "task" ("parentTaskId")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_task_taskTypeId" ON "task" ("taskTypeId")
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_task_isProject" ON "task" ("isProject")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_task_isProject"
        `);

    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_task_taskTypeId"
        `);

    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_task_parentTaskId"
        `);

    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_project_group_tasks_taskId"
        `);

    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_project_group_tasks_projectGroupId"
        `);

    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_task_co_assignees_resourceId"
        `);

    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_task_co_assignees_taskId"
        `);

    // Drop foreign key constraints
    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_taskTypeId'
                ) THEN
                    ALTER TABLE "task" DROP CONSTRAINT "FK_task_taskTypeId";
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_parentTaskId'
                ) THEN
                    ALTER TABLE "task" DROP CONSTRAINT "FK_task_parentTaskId";
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_project_group_tasks_taskId'
                ) THEN
                    ALTER TABLE "project_group_tasks" DROP CONSTRAINT "FK_project_group_tasks_taskId";
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_project_group_tasks_projectGroupId'
                ) THEN
                    ALTER TABLE "project_group_tasks" DROP CONSTRAINT "FK_project_group_tasks_projectGroupId";
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_co_assignees_resourceId'
                ) THEN
                    ALTER TABLE "task_co_assignees" DROP CONSTRAINT "FK_task_co_assignees_resourceId";
                END IF;
            END $$;
        `);

    await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'FK_task_co_assignees_taskId'
                ) THEN
                    ALTER TABLE "task_co_assignees" DROP CONSTRAINT "FK_task_co_assignees_taskId";
                END IF;
            END $$;
        `);

    // Drop join table indexes
    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_task_co_assignees_resourceId"
        `);

    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_task_co_assignees_taskId"
        `);

    // Drop join tables
    await queryRunner.query(`
            DROP TABLE IF EXISTS "project_group_tasks"
        `);

    await queryRunner.query(`
            DROP TABLE IF EXISTS "task_co_assignees"
        `);

    // Drop new columns
    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "taskTypeName"
        `);

    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "taskTypeId"
        `);

    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "parentTaskId"
        `);

    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "isProject"
        `);

    await queryRunner.query(`
            ALTER TABLE "task" DROP COLUMN IF EXISTS "startDate"
        `);

    // Add back old columns
    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN "isMiniProject" boolean NOT NULL DEFAULT false
        `);

    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN "projectGroupId" integer NOT NULL
        `);

    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN "projectId" integer NOT NULL
        `);

    await queryRunner.query(`
            ALTER TABLE "task" ADD COLUMN "coAssigneeId" integer
        `);

    // Make companyId NOT NULL again
    await queryRunner.query(`
            ALTER TABLE "task" ALTER COLUMN "companyId" SET NOT NULL
        `);

    // Add back foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "task"
            ADD CONSTRAINT "FK_task_projectGroupId"
            FOREIGN KEY ("projectGroupId")
            REFERENCES "project_group"("id")
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "task"
            ADD CONSTRAINT "FK_task_projectId"
            FOREIGN KEY ("projectId")
            REFERENCES "project"("id")
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "task"
            ADD CONSTRAINT "FK_task_coAssigneeId"
            FOREIGN KEY ("coAssigneeId")
            REFERENCES "resource"("id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION
        `);
  }
}
