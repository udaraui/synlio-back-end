import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTicketTable1772500000000 implements MigrationInterface {
  name = 'CreateTicketTable1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create Ticket table
    await queryRunner.query(`
      CREATE TABLE "ticket" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "code" character varying NOT NULL,
        "description" text,
        "ticketSpaceId" integer NOT NULL,
        "ticketSpaceName" character varying,
        "statusId" integer,
        "severityId" integer,
        "ticketTypeId" integer,
        "departmentId" integer,
        "impactId" integer,
        "assigneeId" integer,
        "plannedEffort" numeric(10,2),
        "actualEffort" numeric(10,2),
        CONSTRAINT "UQ_ticket_code" UNIQUE ("code"),
        CONSTRAINT "PK_ticket" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_ticketSpaceId" ON "ticket" ("ticketSpaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_statusId" ON "ticket" ("statusId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_severityId" ON "ticket" ("severityId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_ticketTypeId" ON "ticket" ("ticketTypeId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_departmentId" ON "ticket" ("departmentId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_impactId" ON "ticket" ("impactId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_assigneeId" ON "ticket" ("assigneeId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_code" ON "ticket" ("code")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_ticketSpace"
      FOREIGN KEY ("ticketSpaceId")
      REFERENCES "ticket_space"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_status"
      FOREIGN KEY ("statusId")
      REFERENCES "status"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_severity"
      FOREIGN KEY ("severityId")
      REFERENCES "severity"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_ticketType"
      FOREIGN KEY ("ticketTypeId")
      REFERENCES "ticket_type"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_department"
      FOREIGN KEY ("departmentId")
      REFERENCES "division"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_impact"
      FOREIGN KEY ("impactId")
      REFERENCES "ticket_impact"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_assignee"
      FOREIGN KEY ("assigneeId")
      REFERENCES "ticket_permission"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    // Create ticket_participants join table for many-to-many relation
    await queryRunner.query(`
      CREATE TABLE "ticket_participants" (
        "ticketId" integer NOT NULL,
        "permissionId" integer NOT NULL,
        CONSTRAINT "PK_ticket_participants" PRIMARY KEY ("ticketId", "permissionId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_participants_ticketId" ON "ticket_participants" ("ticketId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_participants_permissionId" ON "ticket_participants" ("permissionId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_participants"
      ADD CONSTRAINT "FK_ticket_participants_ticket"
      FOREIGN KEY ("ticketId")
      REFERENCES "ticket"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_participants"
      ADD CONSTRAINT "FK_ticket_participants_permission"
      FOREIGN KEY ("permissionId")
      REFERENCES "ticket_permission"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop ticket_participants table
    await queryRunner.query(`
      ALTER TABLE "ticket_participants" DROP CONSTRAINT "FK_ticket_participants_permission"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_participants" DROP CONSTRAINT "FK_ticket_participants_ticket"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_participants_permissionId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_participants_ticketId"
    `);

    await queryRunner.query(`
      DROP TABLE "ticket_participants"
    `);

    // Drop foreign key constraints from ticket table
    await queryRunner.query(`
      ALTER TABLE "ticket" DROP CONSTRAINT "FK_ticket_assignee"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket" DROP CONSTRAINT "FK_ticket_impact"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket" DROP CONSTRAINT "FK_ticket_department"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket" DROP CONSTRAINT "FK_ticket_ticketType"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket" DROP CONSTRAINT "FK_ticket_severity"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket" DROP CONSTRAINT "FK_ticket_status"
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket" DROP CONSTRAINT "FK_ticket_ticketSpace"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "IDX_ticket_code"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_assigneeId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_impactId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_departmentId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_ticketTypeId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_severityId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_statusId"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_ticket_ticketSpaceId"
    `);

    // Drop ticket table
    await queryRunner.query(`
      DROP TABLE "ticket"
    `);
  }
}
