import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskChecklistItemTable1770334796781
  implements MigrationInterface
{
  name = 'CreateTaskChecklistItemTable1770334796781';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create TaskChecklistItem table
    await queryRunner.query(`
            CREATE TABLE "task_checklist_item" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "createdBy" character varying(50),
                "updatedBy" character varying(50),
                "name" character varying NOT NULL,
                "isChecked" boolean NOT NULL DEFAULT false,
                "attachmentLink" text,
                "taskId" integer NOT NULL,
                CONSTRAINT "PK_task_checklist_item" PRIMARY KEY ("id")
            )
        `);

    // Create index on taskId for better query performance
    await queryRunner.query(`
            CREATE INDEX "IDX_task_checklist_item_taskId" ON "task_checklist_item" ("taskId")
        `);

    // Add foreign key to Task
    await queryRunner.query(`
            ALTER TABLE "task_checklist_item"
            ADD CONSTRAINT "FK_task_checklist_item_taskId"
            FOREIGN KEY ("taskId")
            REFERENCES "task"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "task_checklist_item"
            DROP CONSTRAINT "FK_task_checklist_item_taskId"
        `);

    // Drop index
    await queryRunner.query(`
            DROP INDEX "IDX_task_checklist_item_taskId"
        `);

    // Drop table
    await queryRunner.query(`
            DROP TABLE "task_checklist_item"
        `);
  }
}
