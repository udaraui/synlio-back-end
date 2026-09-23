import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCompanyWiseProjectGroupView1737555000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing view
    await queryRunner.query(
      `DROP VIEW IF EXISTS company_wise_project_group_view`,
    );

    // Recreate the view with projectGroupStructureDtls
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
                                   'isProject', t."isProject",
                                   'startDate', t."startDate",
                                   'dueDate', t."dueDate",
                                   'completionDate', t."completionDate",
                                   'assigneeId', t."assigneeId",
                                   'taskTypeId', t."taskTypeId",
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
    // Drop the view
    await queryRunner.query(
      `DROP VIEW IF EXISTS company_wise_project_group_view`,
    );

    // Recreate the old view without projectGroupStructureDtls
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
             coalesce(agg_tasks.tasks, '[]'::json)         AS tasks
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
                                   'isProject', t."isProject",
                                   'startDate', t."startDate",
                                   'dueDate', t."dueDate",
                                   'completionDate', t."completionDate",
                                   'assigneeId', t."assigneeId",
                                   'taskTypeId', t."taskTypeId",
                                   'parentTaskId', t."parentTaskId"
                                 ) ORDER BY t.id
                               ) AS tasks
                        FROM public.task t
                        WHERE t."projectGroupId" IS NOT NULL
                        GROUP BY t."projectGroupId") AS agg_tasks ON agg_tasks."projectGroupId" = pg.id
      ORDER BY pg.id;
    `);
  }
}
