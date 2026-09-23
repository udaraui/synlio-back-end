import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTicketAttachmentTable1772500100000
  implements MigrationInterface
{
  name = 'CreateTicketAttachmentTable1772500100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create TicketAttachment table
    await queryRunner.query(`
      CREATE TABLE "ticket_attachment" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "link" text NOT NULL,
        "ticketId" integer NOT NULL,
        CONSTRAINT "PK_ticket_attachment" PRIMARY KEY ("id")
      )
    `);

    // Create index for ticketId
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_attachment_ticketId" ON "ticket_attachment" ("ticketId")
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "ticket_attachment"
      ADD CONSTRAINT "FK_ticket_attachment_ticket"
      FOREIGN KEY ("ticketId")
      REFERENCES "ticket"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "ticket_attachment"
      DROP CONSTRAINT "FK_ticket_attachment_ticket"
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX "IDX_ticket_attachment_ticketId"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE "ticket_attachment"
    `);
  }
}
