import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorStatusEntities1783309198990 implements MigrationInterface {
  name = 'RefactorStatusEntities1783309198990'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old foreign keys
    await queryRunner.query(`ALTER TABLE "tm_task" DROP CONSTRAINT "FK_tm_task_status"`);
    await queryRunner.query(`ALTER TABLE "ticket" DROP CONSTRAINT "FK_ticket_status"`);

    // Create Enums
    await queryRunner.query(`CREATE TYPE "public"."task_space_status_config_base_enum" AS ENUM('To Start', 'Processing', 'Finished')`);
    await queryRunner.query(`CREATE TYPE "public"."ticket_space_status_config_base_enum" AS ENUM('To Start', 'Processing', 'Finished')`);

    // Create Tables
    await queryRunner.query(`CREATE TABLE "task_space_status_config" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying(50), "updatedBy" character varying(50), "taskSpaceId" integer NOT NULL, "sequence" integer NOT NULL DEFAULT '0', "name" character varying(255) NOT NULL, "color" character varying(50) NOT NULL DEFAULT '#6366f1', "base" "public"."task_space_status_config_base_enum" NOT NULL, "isPrimaryBase" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_5cc341df4dbf3f91e08d5c478d0" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "ticket_space_status_config" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying(50), "updatedBy" character varying(50), "ticketSpaceId" integer NOT NULL, "sequence" integer NOT NULL DEFAULT '0', "name" character varying(255) NOT NULL, "color" character varying(50) NOT NULL DEFAULT '#6366f1', "base" "public"."ticket_space_status_config_base_enum" NOT NULL, "isPrimaryBase" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_2070dc955a9b257865f6000bc61" PRIMARY KEY ("id"))`);

    // Add foreign keys for new tables
    await queryRunner.query(`ALTER TABLE "task_space_status_config" ADD CONSTRAINT "FK_6d4290cb8fac8fa2eccbeabf722" FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "ticket_space_status_config" ADD CONSTRAINT "FK_152897df0dd39a3b1b4d479fdbd" FOREIGN KEY ("ticketSpaceId") REFERENCES "ticket_space"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    // Migrate Data
    await queryRunner.query(`
          INSERT INTO "task_space_status_config" ("taskSpaceId", "sequence", "name", "color", "base", "isPrimaryBase", "createdAt", "updatedAt")
          SELECT 
            src."taskSpaceId", 
            1, 
            p.name, 
            p.color, 
            CAST(p.base::text AS "task_space_status_config_base_enum"),
            p."isPrimaryBase",
            NOW(),
            NOW()
          FROM (
            SELECT "taskSpaceId", "statusId" FROM "task_space_status"
            UNION
            SELECT "taskSpaceId", "statusId" FROM "tm_task" WHERE "statusId" IS NOT NULL
          ) src
          JOIN "status" s ON s.id = src."statusId"
          JOIN (
            SELECT DISTINCT ON (base::text) name, color, base, "isPrimaryBase"
            FROM "status"
            WHERE "isPrimaryBase" = true AND "postType" = 'Task'
            ORDER BY base::text, id ASC
          ) p ON p.base::text = s.base::text
          GROUP BY src."taskSpaceId", p.name, p.color, p.base::text, p."isPrimaryBase";
        `);

    await queryRunner.query(`
          INSERT INTO "ticket_space_status_config" ("ticketSpaceId", "sequence", "name", "color", "base", "isPrimaryBase", "createdAt", "updatedAt")
          SELECT 
            src."ticketSpaceId", 
            1, 
            p.name, 
            p.color, 
            CAST(p.base::text AS "ticket_space_status_config_base_enum"),
            p."isPrimaryBase",
            NOW(),
            NOW()
          FROM (
            SELECT "ticketSpaceId", "statusId" FROM "ticket_space_status"
            UNION
            SELECT "ticketSpaceId", "statusId" FROM "ticket" WHERE "statusId" IS NOT NULL
          ) src
          JOIN "status" s ON s.id = src."statusId"
          JOIN (
            SELECT DISTINCT ON (base::text) name, color, base, "isPrimaryBase"
            FROM "status"
            WHERE "isPrimaryBase" = true AND "postType" = 'Ticket'
            ORDER BY base::text, id ASC
          ) p ON p.base::text = s.base::text
          GROUP BY src."ticketSpaceId", p.name, p.color, p.base::text, p."isPrimaryBase";
        `);

    await queryRunner.query(`
          UPDATE "tm_task"
          SET 
            "statusId" = conf.id,
            "statusName" = conf.name,
            "statusColor" = conf.color,
            "statusBase" = conf.base::text
          FROM "task_space_status_config" conf
          JOIN "status" old_status ON old_status.base::text = conf.base::text
          WHERE "tm_task"."taskSpaceId" = conf."taskSpaceId"
            AND "tm_task"."statusId" = old_status.id;
        `);

    await queryRunner.query(`
          UPDATE "ticket"
          SET 
            "statusId" = conf.id,
            "statusName" = conf.name,
            "statusColor" = conf.color,
            "statusBase" = conf.base::text
          FROM "ticket_space_status_config" conf
          JOIN "status" old_status ON old_status.base::text = conf.base::text
          WHERE "ticket"."ticketSpaceId" = conf."ticketSpaceId"
            AND "ticket"."statusId" = old_status.id;
        `);

    // Add foreign keys for tasks and tickets
    await queryRunner.query(`ALTER TABLE "tm_task" ADD CONSTRAINT "FK_41f68c97c7936873528b5735a39" FOREIGN KEY ("statusId") REFERENCES "task_space_status_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "ticket" ADD CONSTRAINT "FK_7312ac8aab89dd3586729d97ea0" FOREIGN KEY ("statusId") REFERENCES "ticket_space_status_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

    // Cleanup old status table
    await queryRunner.query(`ALTER TABLE "status" DROP CONSTRAINT "FK_status_company"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_status_companyId"`);
    await queryRunner.query(`ALTER TABLE "status" DROP COLUMN "companyId"`);
    await queryRunner.query(`DELETE FROM "status" WHERE "isPrimaryBase" IS NULL OR "isPrimaryBase" = false`);
    
    // Clean up old tables
    await queryRunner.query(`DROP TABLE IF EXISTS "task_space_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_space_status"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add companyId to status table
    await queryRunner.query(`ALTER TABLE "status" ADD "companyId" integer`);
    await queryRunner.query(`CREATE INDEX "IDX_status_companyId" ON "status" ("companyId")`);
    await queryRunner.query(`ALTER TABLE "status" ADD CONSTRAINT "FK_status_company" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

    // Drop new foreign keys from tasks and tickets
    await queryRunner.query(`ALTER TABLE "ticket" DROP CONSTRAINT "FK_7312ac8aab89dd3586729d97ea0"`);
    await queryRunner.query(`ALTER TABLE "tm_task" DROP CONSTRAINT "FK_41f68c97c7936873528b5735a39"`);

    // Drop new config tables and enums
    await queryRunner.query(`DROP TABLE "ticket_space_status_config"`);
    await queryRunner.query(`DROP TABLE "task_space_status_config"`);
    await queryRunner.query(`DROP TYPE "public"."ticket_space_status_config_base_enum"`);
    await queryRunner.query(`DROP TYPE "public"."task_space_status_config_base_enum"`);

    // Restore old foreign keys to status table
    await queryRunner.query(`ALTER TABLE "ticket" ADD CONSTRAINT "FK_ticket_status" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "tm_task" ADD CONSTRAINT "FK_tm_task_status" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }
}
