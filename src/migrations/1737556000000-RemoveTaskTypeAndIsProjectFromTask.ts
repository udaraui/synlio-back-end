import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTaskTypeAndIsProjectFromTask1737556000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint for taskType if it exists
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'FK_task_taskType' 
          AND table_name = 'task'
        ) THEN
          ALTER TABLE "task" DROP CONSTRAINT "FK_task_taskType";
        END IF;
      END $$;
    `);

    // Drop isProject column (CASCADE to drop dependent views)
    await queryRunner.query(`
      ALTER TABLE "task" DROP COLUMN IF EXISTS "isProject" CASCADE
    `);

    // Drop taskTypeId column
    await queryRunner.query(`
      ALTER TABLE "task" DROP COLUMN IF EXISTS "taskTypeId"
    `);

    // Drop taskTypeName column
    await queryRunner.query(`
      ALTER TABLE "task" DROP COLUMN IF EXISTS "taskTypeName"
    `);

    // Recreate company_wise_project_group_view without isProject reference
    await queryRunner.query(`
      CREATE VIEW company_wise_project_group_view AS
      SELECT pg.id,
             pg.name,
             pg.prefix,
             pg.description,
             pg."createdAt",
             pg."updatedAt",
             pg."createdBy",
             pg."updatedBy",
             pg.status,
             c.id                                          AS "companyId",
             c.company                                     AS "companyName",
             c.company_code                                AS "companyCode",
             d.id                                          AS "divisionId",
             d.division                                    AS "divisionName",
             d.division_code                               AS "divisionCode",
             coalesce(agg_owners.owners, '[]'::json)       AS owners,
             coalesce(agg_resources.resources, '[]'::json) AS resources,
             coalesce(agg_tasks.tasks, '[]'::json)         AS tasks,
             coalesce(agg_dtls."projectGroupStructureDtls", '[]'::json) AS "projectGroupStructureDtls"
      FROM public.project_group pg
             JOIN public.company c ON c.id = pg."companyId"
             LEFT JOIN public.division d ON d.id = pg."divisionId"
        -- Aggregation for Owners
             LEFT JOIN (SELECT pgo."projectGroupId",
                               json_agg(
                                 json_build_object(
                                   'id', u.id,
                                   'first_name', u.first_name,
                                   'last_name', u.last_name,
                                   'email', u.email
                                 ) ORDER BY u.id
                               ) AS owners
                        FROM public.project_group_owners pgo
                               JOIN public."user" u ON u.id = pgo."userId"
                        GROUP BY pgo."projectGroupId") AS agg_owners ON agg_owners."projectGroupId" = pg.id
        --Aggregation for Resources
             LEFT JOIN (SELECT pgr."projectGroupId",
                               json_agg(
                                 json_build_object(
                                   'id', r.id,
                                   'first_name', r.first_name,
                                   'last_name', r.last_name,
                                   'email', r.email,
                                   'active_status', r.active_status
                                 ) ORDER BY r.id
                               ) AS resources
                        FROM public.project_group_resources pgr
                               JOIN public.resource r ON r.id = pgr."resourceId"
                        GROUP BY pgr."projectGroupId") AS agg_resources ON agg_resources."projectGroupId" = pg.id
        --Aggregation for Tasks (using direct foreign key)
             LEFT JOIN (SELECT t."projectGroupId",
                               json_agg(
                                 json_build_object(
                                   'id', t.id,
                                   'code', t.code,
                                   'name', t.name,
                                   'description', t.description,
                                   'status', t.status,
                                   'priority', t.priority,
                                   'hierarchyLevel', t."hierarchyLevel",
                                   'startDate', t."startDate",
                                   'dueDate', t."dueDate",
                                   'completionDate', t."completionDate",
                                   'assigneeId', t."assigneeId",
                                   'parentTaskId', t."parentTaskId"
                                 ) ORDER BY t.id
                               ) AS tasks
                        FROM public.task t
                        WHERE t."projectGroupId" IS NOT NULL
                        GROUP BY t."projectGroupId") AS agg_tasks ON agg_tasks."projectGroupId" = pg.id
        --Aggregation for Structure Details
             LEFT JOIN (SELECT pgcs."projectGroupId",
                               json_agg(
                                 json_build_object(
                                   'id', dtl.id,
                                   'name', dtl.name,
                                   'sequence', dtl.sequence,
                                   'status', dtl.status
                                 ) ORDER BY dtl.sequence
                               ) AS "projectGroupStructureDtls"
                        FROM public.project_group_custom_structure pgcs
                               JOIN public.project_group_structure_dtl dtl ON dtl.id = pgcs."dtlId"
                        GROUP BY pgcs."projectGroupId") AS agg_dtls ON agg_dtls."projectGroupId" = pg.id
      ORDER BY pg.id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the recreated view
    await queryRunner.query(
      `DROP VIEW IF EXISTS company_wise_project_group_view CASCADE`,
    );

    // Add back isProject column
    await queryRunner.query(`
      ALTER TABLE "task" ADD COLUMN "isProject" boolean DEFAULT false
    `);

    // Add back taskTypeId column
    await queryRunner.query(`
      ALTER TABLE "task" ADD COLUMN "taskTypeId" integer NULL
    `);

    // Add back taskTypeName column
    await queryRunner.query(`
      ALTER TABLE "task" ADD COLUMN "taskTypeName" varchar NULL
    `);

    // Note: View would need to be recreated with old structure in full rollback
  }
}
