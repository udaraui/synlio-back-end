import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Merges `tm_task_checklist` and `tm_ticket_checklist` into a single
 * polymorphic `tm_checklist` table keyed by (entityType, entityId).
 *
 * Existing rows are intentionally NOT carried over — the previous tables held
 * development data only.
 *
 * `entityId` and `assigneeId` carry no foreign keys because their target
 * depends on `entityType` (Task → tm_task / resource, Ticket → ticket /
 * ticket_space_member). ChecklistService is responsible for the cascade and
 * assignee-cleanup those constraints used to provide.
 */
export class MergeChecklistTables1785800000000 implements MigrationInterface {
  name = 'MergeChecklistTables1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tm_task_checklist"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tm_ticket_checklist"`);

    await queryRunner.query(`
      CREATE TABLE "tm_checklist" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "isChecked" boolean NOT NULL DEFAULT false,
        "attachmentLink" text,
        "entityType" character varying(20) NOT NULL,
        "entityId" integer NOT NULL,
        "assigneeId" integer,
        "assigneeName" character varying(150),
        "assigneeEmail" character varying(255),
        "assigneeProfilePicUrl" text,
        CONSTRAINT "PK_tm_checklist" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_tm_checklist_entityType"
          CHECK ("entityType" IN ('Task', 'Ticket'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tm_checklist_entity"
      ON "tm_checklist" ("entityType", "entityId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tm_checklist_assignee"
      ON "tm_checklist" ("entityType", "assigneeId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tm_checklist"`);

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

    await queryRunner.query(`
      CREATE TABLE "tm_ticket_checklist" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "isChecked" boolean NOT NULL DEFAULT false,
        "attachmentLink" text,
        "ticketId" integer NOT NULL,
        "assigneeId" integer,
        "assigneeName" character varying(150),
        "assigneeEmail" character varying(255),
        "assigneeProfilePicUrl" text,
        CONSTRAINT "PK_tm_ticket_checklist" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tm_ticket_checklist_ticketId" ON "tm_ticket_checklist" ("ticketId")
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_ticket_checklist"
      ADD CONSTRAINT "FK_tm_ticket_checklist_ticketId"
      FOREIGN KEY ("ticketId") REFERENCES "ticket"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tm_ticket_checklist"
      ADD CONSTRAINT "FK_tm_ticket_checklist_assigneeId"
      FOREIGN KEY ("assigneeId") REFERENCES "ticket_space_member"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }
}
