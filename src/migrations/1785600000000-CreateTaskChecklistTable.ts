import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces `tm_task_checklist_item` with `tm_task_checklist`, which adds an
 * optional assignee (plus denormalized assignee display fields).
 * Existing rows are copied across before the old table is dropped.
 */
export class CreateTaskChecklistTable1785600000000
  implements MigrationInterface
{
  name = 'CreateTaskChecklistTable1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tm_task_checklist" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "isChecked" boolean NOT NULL DEFAULT false,
        "attachmentLink" text,
        "taskId" integer NOT NULL,
        "assigneeId" integer,
        "assigneeName" character varying(150),
        "assigneeEmail" character varying(255),
        "assigneeProfilePicUrl" text,
        CONSTRAINT "PK_tm_task_checklist" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tm_task_checklist_taskId" ON "tm_task_checklist" ("taskId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tm_task_checklist_assigneeId" ON "tm_task_checklist" ("assigneeId")
    `);

    await queryRunner.query(`
      ALTER TABLE "tm_task_checklist"
      ADD CONSTRAINT "FK_tm_task_checklist_taskId"
      FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task_checklist"
      ADD CONSTRAINT "FK_tm_task_checklist_assigneeId"
      FOREIGN KEY ("assigneeId") REFERENCES "resource"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Carry over any existing checklist rows, then drop the old table.
    const oldTable = await queryRunner.hasTable('tm_task_checklist_item');
    if (oldTable) {
      await queryRunner.query(`
        INSERT INTO "tm_task_checklist"
          ("createdAt", "updatedAt", "createdBy", "updatedBy",
           "name", "isChecked", "attachmentLink", "taskId")
        SELECT "createdAt", "updatedAt", "createdBy", "updatedBy",
               "name", "isChecked", "attachmentLink", "taskId"
        FROM "tm_task_checklist_item"
      `);
      await queryRunner.query(`DROP TABLE "tm_task_checklist_item"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tm_task_checklist_item" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "isChecked" boolean NOT NULL DEFAULT false,
        "attachmentLink" text,
        "taskId" integer NOT NULL,
        CONSTRAINT "PK_tm_task_checklist_item" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tm_task_checklist_item_taskId" ON "tm_task_checklist_item" ("taskId")
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_task_checklist_item"
      ADD CONSTRAINT "FK_tm_task_checklist_item_taskId"
      FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      INSERT INTO "tm_task_checklist_item"
        ("createdAt", "updatedAt", "createdBy", "updatedBy",
         "name", "isChecked", "attachmentLink", "taskId")
      SELECT "createdAt", "updatedAt", "createdBy", "updatedBy",
             "name", "isChecked", "attachmentLink", "taskId"
      FROM "tm_task_checklist"
    `);

    await queryRunner.query(`DROP TABLE "tm_task_checklist"`);
  }
}
