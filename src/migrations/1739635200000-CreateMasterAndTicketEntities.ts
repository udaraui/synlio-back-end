import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMasterAndTicketEntities1739635200000
  implements MigrationInterface
{
  name = 'CreateMasterAndTicketEntities1739635200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // MASTER MODULE ENTITIES
    // =====================================================

    // Create Status table
    await queryRunner.query(`
      CREATE TABLE "status" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "color" character varying NOT NULL,
        "companyId" integer NOT NULL,
        CONSTRAINT "UQ_status_name" UNIQUE ("name"),
        CONSTRAINT "PK_status" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_status_companyId" ON "status" ("companyId")
    `);

    await queryRunner.query(`
      ALTER TABLE "status"
      ADD CONSTRAINT "FK_status_company"
      FOREIGN KEY ("companyId")
      REFERENCES "company"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    // Create Severity table
    await queryRunner.query(`
      CREATE TABLE "severity" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "color" character varying NOT NULL,
        "companyId" integer NOT NULL,
        CONSTRAINT "UQ_severity_name" UNIQUE ("name"),
        CONSTRAINT "PK_severity" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_severity_companyId" ON "severity" ("companyId")
    `);

    await queryRunner.query(`
      ALTER TABLE "severity"
      ADD CONSTRAINT "FK_severity_company"
      FOREIGN KEY ("companyId")
      REFERENCES "company"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    // =====================================================
    // TICKET MANAGEMENT MODULE ENTITIES
    // =====================================================

    // Create TicketType table
    await queryRunner.query(`
      CREATE TABLE "ticket_type" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "color" character varying NOT NULL,
        "icon" character varying,
        CONSTRAINT "UQ_ticket_type_name" UNIQUE ("name"),
        CONSTRAINT "PK_ticket_type" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_type_name" ON "ticket_type" ("name")
    `);

    // Create TicketSla table
    await queryRunner.query(`
      CREATE TABLE "ticket_sla" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "severityId" integer NOT NULL,
        "severityName" character varying NOT NULL,
        "responseTime" integer NOT NULL,
        "resolutionTime" integer NOT NULL,
        CONSTRAINT "PK_ticket_sla" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_sla_severityId" ON "ticket_sla" ("severityId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_sla"
      ADD CONSTRAINT "FK_ticket_sla_severity"
      FOREIGN KEY ("severityId")
      REFERENCES "severity"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    // Create TicketImpact table
    await queryRunner.query(`
      CREATE TABLE "ticket_impact" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "description" character varying,
        CONSTRAINT "UQ_ticket_impact_name" UNIQUE ("name"),
        CONSTRAINT "PK_ticket_impact" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_impact_name" ON "ticket_impact" ("name")
    `);

    // Create TicketQueue table
    await queryRunner.query(`
      CREATE TABLE "ticket_queue" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "description" character varying,
        CONSTRAINT "UQ_ticket_queue_name" UNIQUE ("name"),
        CONSTRAINT "PK_ticket_queue" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_queue_name" ON "ticket_queue" ("name")
    `);

    // Create TicketSpace table
    await queryRunner.query(`
      CREATE TABLE "ticket_space" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying NOT NULL,
        "prefix" character varying NOT NULL,
        "description" character varying,
        "companyId" integer NOT NULL,
        "ticketQueueId" integer NOT NULL,
        "ticketQueueName" character varying NOT NULL,
        CONSTRAINT "UQ_ticket_space_prefix_company" UNIQUE ("prefix", "companyId"),
        CONSTRAINT "PK_ticket_space" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_companyId" ON "ticket_space" ("companyId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_ticketQueueId" ON "ticket_space" ("ticketQueueId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ADD CONSTRAINT "FK_ticket_space_company"
      FOREIGN KEY ("companyId")
      REFERENCES "company"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ADD CONSTRAINT "FK_ticket_space_queue"
      FOREIGN KEY ("ticketQueueId")
      REFERENCES "ticket_queue"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);

    // =====================================================
    // JUNCTION TABLES FOR TICKET SPACE MANY-TO-MANY RELATIONSHIPS
    // =====================================================

    // TicketSpace <-> Status
    await queryRunner.query(`
      CREATE TABLE "ticket_space_status" (
        "ticketSpaceId" integer NOT NULL,
        "statusId" integer NOT NULL,
        CONSTRAINT "PK_ticket_space_status" PRIMARY KEY ("ticketSpaceId", "statusId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_status_ticketSpaceId" ON "ticket_space_status" ("ticketSpaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_status_statusId" ON "ticket_space_status" ("statusId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_status"
      ADD CONSTRAINT "FK_ticket_space_status_space"
      FOREIGN KEY ("ticketSpaceId")
      REFERENCES "ticket_space"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_status"
      ADD CONSTRAINT "FK_ticket_space_status_status"
      FOREIGN KEY ("statusId")
      REFERENCES "status"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // TicketSpace <-> Severity
    await queryRunner.query(`
      CREATE TABLE "ticket_space_severity" (
        "ticketSpaceId" integer NOT NULL,
        "severityId" integer NOT NULL,
        CONSTRAINT "PK_ticket_space_severity" PRIMARY KEY ("ticketSpaceId", "severityId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_severity_ticketSpaceId" ON "ticket_space_severity" ("ticketSpaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_severity_severityId" ON "ticket_space_severity" ("severityId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_severity"
      ADD CONSTRAINT "FK_ticket_space_severity_space"
      FOREIGN KEY ("ticketSpaceId")
      REFERENCES "ticket_space"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_severity"
      ADD CONSTRAINT "FK_ticket_space_severity_severity"
      FOREIGN KEY ("severityId")
      REFERENCES "severity"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // TicketSpace <-> TicketType
    await queryRunner.query(`
      CREATE TABLE "ticket_space_type" (
        "ticketSpaceId" integer NOT NULL,
        "ticketTypeId" integer NOT NULL,
        CONSTRAINT "PK_ticket_space_type" PRIMARY KEY ("ticketSpaceId", "ticketTypeId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_type_ticketSpaceId" ON "ticket_space_type" ("ticketSpaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_type_ticketTypeId" ON "ticket_space_type" ("ticketTypeId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_type"
      ADD CONSTRAINT "FK_ticket_space_type_space"
      FOREIGN KEY ("ticketSpaceId")
      REFERENCES "ticket_space"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_type"
      ADD CONSTRAINT "FK_ticket_space_type_type"
      FOREIGN KEY ("ticketTypeId")
      REFERENCES "ticket_type"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // TicketSpace <-> TicketSla
    await queryRunner.query(`
      CREATE TABLE "ticket_space_sla" (
        "ticketSpaceId" integer NOT NULL,
        "ticketSlaId" integer NOT NULL,
        CONSTRAINT "PK_ticket_space_sla" PRIMARY KEY ("ticketSpaceId", "ticketSlaId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_sla_ticketSpaceId" ON "ticket_space_sla" ("ticketSpaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_sla_ticketSlaId" ON "ticket_space_sla" ("ticketSlaId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_sla"
      ADD CONSTRAINT "FK_ticket_space_sla_space"
      FOREIGN KEY ("ticketSpaceId")
      REFERENCES "ticket_space"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_sla"
      ADD CONSTRAINT "FK_ticket_space_sla_sla"
      FOREIGN KEY ("ticketSlaId")
      REFERENCES "ticket_sla"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // TicketSpace <-> TicketImpact
    await queryRunner.query(`
      CREATE TABLE "ticket_space_impact" (
        "ticketSpaceId" integer NOT NULL,
        "ticketImpactId" integer NOT NULL,
        CONSTRAINT "PK_ticket_space_impact" PRIMARY KEY ("ticketSpaceId", "ticketImpactId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_impact_ticketSpaceId" ON "ticket_space_impact" ("ticketSpaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_impact_ticketImpactId" ON "ticket_space_impact" ("ticketImpactId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_impact"
      ADD CONSTRAINT "FK_ticket_space_impact_space"
      FOREIGN KEY ("ticketSpaceId")
      REFERENCES "ticket_space"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_impact"
      ADD CONSTRAINT "FK_ticket_space_impact_impact"
      FOREIGN KEY ("ticketImpactId")
      REFERENCES "ticket_impact"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // TicketSpace <-> User (members)
    await queryRunner.query(`
      CREATE TABLE "ticket_space_members" (
        "ticketSpaceId" integer NOT NULL,
        "userId" integer NOT NULL,
        CONSTRAINT "PK_ticket_space_members" PRIMARY KEY ("ticketSpaceId", "userId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_members_ticketSpaceId" ON "ticket_space_members" ("ticketSpaceId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_space_members_userId" ON "ticket_space_members" ("userId")
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_members"
      ADD CONSTRAINT "FK_ticket_space_members_space"
      FOREIGN KEY ("ticketSpaceId")
      REFERENCES "ticket_space"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "ticket_space_members"
      ADD CONSTRAINT "FK_ticket_space_members_user"
      FOREIGN KEY ("userId")
      REFERENCES "user"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop junction tables first (foreign key dependencies)
    await queryRunner.query(`DROP TABLE "ticket_space_members"`);
    await queryRunner.query(`DROP TABLE "ticket_space_impact"`);
    await queryRunner.query(`DROP TABLE "ticket_space_sla"`);
    await queryRunner.query(`DROP TABLE "ticket_space_type"`);
    await queryRunner.query(`DROP TABLE "ticket_space_severity"`);
    await queryRunner.query(`DROP TABLE "ticket_space_status"`);

    // Drop TicketSpace
    await queryRunner.query(
      `ALTER TABLE "ticket_space" DROP CONSTRAINT "FK_ticket_space_queue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_space" DROP CONSTRAINT "FK_ticket_space_company"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_ticket_space_ticketQueueId"`);
    await queryRunner.query(`DROP INDEX "IDX_ticket_space_companyId"`);
    await queryRunner.query(`DROP TABLE "ticket_space"`);

    // Drop TicketQueue
    await queryRunner.query(`DROP INDEX "IDX_ticket_queue_name"`);
    await queryRunner.query(`DROP TABLE "ticket_queue"`);

    // Drop TicketImpact
    await queryRunner.query(`DROP INDEX "IDX_ticket_impact_name"`);
    await queryRunner.query(`DROP TABLE "ticket_impact"`);

    // Drop TicketSla
    await queryRunner.query(
      `ALTER TABLE "ticket_sla" DROP CONSTRAINT "FK_ticket_sla_severity"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_ticket_sla_severityId"`);
    await queryRunner.query(`DROP TABLE "ticket_sla"`);

    // Drop TicketType
    await queryRunner.query(`DROP INDEX "IDX_ticket_type_name"`);
    await queryRunner.query(`DROP TABLE "ticket_type"`);

    // Drop Severity
    await queryRunner.query(
      `ALTER TABLE "severity" DROP CONSTRAINT "FK_severity_company"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_severity_companyId"`);
    await queryRunner.query(`DROP TABLE "severity"`);

    // Drop Status
    await queryRunner.query(
      `ALTER TABLE "status" DROP CONSTRAINT "FK_status_company"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_status_companyId"`);
    await queryRunner.query(`DROP TABLE "status"`);
  }
}
