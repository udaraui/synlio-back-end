import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `tm_ticket_checklist` — the ticket-side counterpart of
 * `tm_task_checklist`, with the same optional assignee support.
 */
export class CreateTicketChecklistTable1785600000001
  implements MigrationInterface
{
  name = 'CreateTicketChecklistTable1785600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      CREATE INDEX "IDX_tm_ticket_checklist_assigneeId" ON "tm_ticket_checklist" ("assigneeId")
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tm_ticket_checklist"`);
  }
}
