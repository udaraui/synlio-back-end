import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorSeveritySla1784596717598 implements MigrationInterface {
    name = 'RefactorSeveritySla1784596717598'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create New Config Tables
        await queryRunner.query(`CREATE TABLE "task_space_severity_config" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying(50), "updatedBy" character varying(50), "taskSpaceId" integer NOT NULL, "name" character varying(255) NOT NULL, "color" character varying(50) NOT NULL DEFAULT '#6366f1', "responseTimeInMinutes" integer NOT NULL DEFAULT '0', "resolutionTimeInMinutes" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_8dc4011d1ae5bf2aa8d331a1a0a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ticket_space_severity_config" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying(50), "updatedBy" character varying(50), "ticketSpaceId" integer NOT NULL, "name" character varying(255) NOT NULL, "color" character varying(50) NOT NULL DEFAULT '#6366f1', "responseTimeInMinutes" integer NOT NULL DEFAULT '0', "resolutionTimeInMinutes" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_d35bd627e4b024963187dc235c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ticket_space_type_config" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying(50), "updatedBy" character varying(50), "ticketSpaceId" integer NOT NULL, "sequence" integer NOT NULL DEFAULT '0', "name" character varying(255) NOT NULL, "color" character varying(50) NOT NULL DEFAULT '#6366f1', "icon" character varying, CONSTRAINT "PK_835a8a6b880e810a98deace554b" PRIMARY KEY ("id"))`);

        // 1.5. Drop old foreign keys before data migration
        await queryRunner.query(`
            DO $$ 
            DECLARE stmt text; 
            BEGIN
                -- tm_task severity
                FOR stmt IN SELECT 'ALTER TABLE "tm_task" DROP CONSTRAINT "' || conname || '";' FROM pg_constraint JOIN pg_class ON conrelid = pg_class.oid WHERE relname = 'tm_task' AND (conname ILIKE '%severity%' OR conname = 'FK_tm_task_severity')
                LOOP EXECUTE stmt; END LOOP;

                -- ticket severity
                FOR stmt IN SELECT 'ALTER TABLE "ticket" DROP CONSTRAINT "' || conname || '";' FROM pg_constraint JOIN pg_class ON conrelid = pg_class.oid WHERE relname = 'ticket' AND (conname ILIKE '%severity%' OR conname = 'FK_ticket_severity')
                LOOP EXECUTE stmt; END LOOP;

                -- ticket type
                FOR stmt IN SELECT 'ALTER TABLE "ticket" DROP CONSTRAINT "' || conname || '";' FROM pg_constraint JOIN pg_class ON conrelid = pg_class.oid WHERE relname = 'ticket' AND (conname ILIKE '%ticketType%' OR conname = 'FK_ticket_ticketType')
                LOOP EXECUTE stmt; END LOOP;
            END $$;
        `);

        // 1.6. Update the trigger function to remove references to the soon-to-be-dropped ticketSlaId column
        // This must happen before any UPDATE statements run on the ticket table!
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.fn_ticket_version_manager()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    NEW."ticketVersion" := 1;
                    RETURN NEW;
                END IF;

                IF TG_OP = 'UPDATE' THEN
                    IF NEW."name" IS DISTINCT FROM OLD."name" OR
                    NEW."description" IS DISTINCT FROM OLD."description" OR
                    NEW."statusId" IS DISTINCT FROM OLD."statusId" OR
                    NEW."assigneeId" IS DISTINCT FROM OLD."assigneeId" OR
                    NEW."severityId" IS DISTINCT FROM OLD."severityId" OR
                    NEW."ticketTypeId" IS DISTINCT FROM OLD."ticketTypeId" OR
                    NEW."queueId" IS DISTINCT FROM OLD."queueId" OR
                    NEW."plannedEffort" IS DISTINCT FROM OLD."plannedEffort" OR
                    NEW."actualEffort" IS DISTINCT FROM OLD."actualEffort" OR
                    NEW."statusName" IS DISTINCT FROM OLD."statusName" OR
                    NEW."severityName" IS DISTINCT FROM OLD."severityName" OR
                    NEW."ticketTypeName" IS DISTINCT FROM OLD."ticketTypeName" OR
                    NEW."queueName" IS DISTINCT FROM OLD."queueName" OR
                    NEW."impactName" IS DISTINCT FROM OLD."impactName" OR
                    NEW."slaResponseTime" IS DISTINCT FROM OLD."slaResponseTime" OR
                    NEW."slaResolutionTime" IS DISTINCT FROM OLD."slaResolutionTime" OR
                    NEW."assigneeName" IS DISTINCT FROM OLD."assigneeName" OR
                    NEW."assigneeProfilePicUrl" IS DISTINCT FROM OLD."assigneeProfilePicUrl" OR
                    NEW."slaResponseDeadline" IS DISTINCT FROM OLD."slaResponseDeadline" OR
                    NEW."slaResolutionDeadline" IS DISTINCT FROM OLD."slaResolutionDeadline" OR
                    NEW."completionDate" IS DISTINCT FROM OLD."completionDate"
                    THEN
                        NEW."ticketVersion" := COALESCE(OLD."ticketVersion", 0) + 1;
                    END IF;
                    RETURN NEW;
                END IF;

                RETURN NEW;
            END;
            $$;
        `);

        // 2. Data Migration: Populate Space Configs and Reassign Tickets/Tasks
        // Populate task_space_severity_config (migrating existing severities from old join table)
        await queryRunner.query(`
            INSERT INTO "task_space_severity_config" ("taskSpaceId", "name", "color", "responseTimeInMinutes", "resolutionTimeInMinutes", "createdAt", "updatedAt")
            SELECT tss."taskSpaceId", s.name, s.color, 0, 0, NOW(), NOW()
            FROM "task_space_severity" tss
            INNER JOIN "severity" s ON s.id = tss."severityId"
        `);

        // Populate ticket_space_severity_config (migrating SLA values and existing severities, preventing duplicates)
        await queryRunner.query(`
            INSERT INTO "ticket_space_severity_config" ("ticketSpaceId", "name", "color", "responseTimeInMinutes", "resolutionTimeInMinutes", "createdAt", "updatedAt")
            SELECT DISTINCT ON (tss."ticketSpaceId", s.id)
                tss."ticketSpaceId", s.name, s.color, COALESCE(sla."responseTime", 0), COALESCE(sla."resolutionTime", 0), NOW(), NOW()
            FROM "ticket_space_severity" tss
            INNER JOIN "severity" s ON s.id = tss."severityId"
            LEFT JOIN "ticket_space_sla" tssla ON tssla."ticketSpaceId" = tss."ticketSpaceId"
            LEFT JOIN "ticket_sla" sla ON sla.id = tssla."ticketSlaId" AND sla."severityId" = s.id
            WHERE s.id IN (1, 2, 3, 4)
            ORDER BY tss."ticketSpaceId", s.id, sla.id DESC
        `);

        // Populate ticket_space_type_config (migrating existing types from old join table)
        await queryRunner.query(`
            INSERT INTO "ticket_space_type_config" ("ticketSpaceId", "sequence", "name", "color", "icon", "createdAt", "updatedAt")
            SELECT tst."ticketSpaceId", 0, t.name, t.color, t.icon, NOW(), NOW()
            FROM "ticket_space_type" tst
            INNER JOIN "ticket_type" t ON t.id = tst."ticketTypeId"
        `);

        // Update Tasks to point to the new task_space_severity_config rows
        await queryRunner.query(`
            UPDATE "tm_task" t
            SET "severityId" = COALESCE(
                (SELECT tssc.id FROM "task_space_severity_config" tssc WHERE tssc."taskSpaceId" = t."taskSpaceId" AND tssc.name = t."severityName" LIMIT 1),
                (SELECT tssc.id FROM "task_space_severity_config" tssc WHERE tssc."taskSpaceId" = t."taskSpaceId" AND tssc.name = 'Medium' LIMIT 1)
            )
            WHERE "severityId" IS NOT NULL;
        `);

        // Update Tickets to point to the new ticket_space_severity_config rows
        await queryRunner.query(`
            UPDATE "ticket" t
            SET "severityId" = COALESCE(
                (SELECT tssc.id FROM "ticket_space_severity_config" tssc WHERE tssc."ticketSpaceId" = t."ticketSpaceId" AND tssc.name = t."severityName" LIMIT 1),
                (SELECT tssc.id FROM "ticket_space_severity_config" tssc WHERE tssc."ticketSpaceId" = t."ticketSpaceId" AND tssc.name = 'Medium' LIMIT 1)
            )
            WHERE "severityId" IS NOT NULL;
        `);
        // Update Tickets to point to the new ticket_space_type_config rows
        await queryRunner.query(`
            UPDATE "ticket" t
            SET "ticketTypeId" = COALESCE(
                (SELECT tstc.id FROM "ticket_space_type_config" tstc WHERE tstc."ticketSpaceId" = t."ticketSpaceId" AND tstc.name = t."ticketTypeName" LIMIT 1),
                (SELECT tstc.id FROM "ticket_space_type_config" tstc WHERE tstc."ticketSpaceId" = t."ticketSpaceId" LIMIT 1)
            )
            WHERE "ticketTypeId" IS NOT NULL;
        `);
        // 3. Drop ticketSlaId from ticket and ticket_sla table completely
        await queryRunner.query(`ALTER TABLE "ticket" DROP COLUMN "ticketSlaId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_space_sla" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_sla" CASCADE`);

        // 4. Drop obsolete join tables that were replaced by config tables
        await queryRunner.query(`DROP TABLE IF EXISTS "task_space_severity" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_space_severity" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_space_type" CASCADE`);

        // 4.5. Delete non-master custom severities and ticket types
        await queryRunner.query(`
            DELETE FROM "severity" WHERE "id" NOT IN (1, 2, 3, 4, 5, 6, 7);
        `);
        await queryRunner.query(`
            DELETE FROM "ticket_type" WHERE "id" NOT IN (1, 2, 3, 4);
        `);

        // 5. Clean up Ticket Types (Keep basic ones: 1=Bugs, 2=Service Request, etc.. we will just remove custom ones if any)
        // Ensure companyId is dropped from severity and ticket_type if they exist
        await queryRunner.query(`ALTER TABLE "severity" DROP COLUMN IF EXISTS "companyId"`);
        await queryRunner.query(`ALTER TABLE "ticket_type" DROP COLUMN IF EXISTS "companyId"`);

        // 6. Add Foreign Key Constraints for the new space configuration tables
        await queryRunner.query(`ALTER TABLE "task_space_severity_config" ADD CONSTRAINT "FK_f8073c3f834870be6dff3da1513" FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_space_severity_config" ADD CONSTRAINT "FK_1e2f2efa7700a8c29f0bc22e30c" FOREIGN KEY ("ticketSpaceId") REFERENCES "ticket_space"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_space_type_config" ADD CONSTRAINT "FK_57e9217a68554b368e0e1e0b4bc" FOREIGN KEY ("ticketSpaceId") REFERENCES "ticket_space"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Add foreign keys for ticket / tm_task to the new space severity configs
        await queryRunner.query(`ALTER TABLE "tm_task" ADD CONSTRAINT "FK_eb0e0a6ae9592f45f1a75b17a8f" FOREIGN KEY ("severityId") REFERENCES "task_space_severity_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket" ADD CONSTRAINT "FK_ed68ddea4da09e8ebe8ac30fcfe" FOREIGN KEY ("severityId") REFERENCES "ticket_space_severity_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket" ADD CONSTRAINT "FK_7061359da242fbf565771953137" FOREIGN KEY ("ticketTypeId") REFERENCES "ticket_space_type_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Just roll back the table creation. Re-creating the dropped columns/tables data is generally not feasible 
        // without backups, so we only handle schema reversal here.
        await queryRunner.query(`ALTER TABLE "ticket" DROP CONSTRAINT "FK_7061359da242fbf565771953137"`);
        await queryRunner.query(`ALTER TABLE "ticket" DROP CONSTRAINT "FK_ed68ddea4da09e8ebe8ac30fcfe"`);
        await queryRunner.query(`ALTER TABLE "tm_task" DROP CONSTRAINT "FK_eb0e0a6ae9592f45f1a75b17a8f"`);

        await queryRunner.query(`ALTER TABLE "ticket_space_type_config" DROP CONSTRAINT "FK_57e9217a68554b368e0e1e0b4bc"`);
        await queryRunner.query(`ALTER TABLE "ticket_space_severity_config" DROP CONSTRAINT "FK_1e2f2efa7700a8c29f0bc22e30c"`);
        await queryRunner.query(`ALTER TABLE "task_space_severity_config" DROP CONSTRAINT "FK_f8073c3f834870be6dff3da1513"`);

        await queryRunner.query(`ALTER TABLE "ticket" ADD "ticketSlaId" integer`);
        await queryRunner.query(`ALTER TABLE "ticket_type" ADD "companyId" integer`);
        await queryRunner.query(`ALTER TABLE "severity" ADD "companyId" integer`);

        await queryRunner.query(`DROP TABLE "ticket_space_type_config"`);
        await queryRunner.query(`DROP TABLE "ticket_space_severity_config"`);
        await queryRunner.query(`DROP TABLE "task_space_severity_config"`);
    }
}
