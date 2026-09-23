import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateViewsForTaskProjectGroupRelation1734960100000
  implements MigrationInterface
{
  name = 'UpdateViewsForTaskProjectGroupRelation1734960100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing view
    await queryRunner.query(`
            DROP VIEW IF EXISTS "company_wise_project_group_view" CASCADE
        `);

    // Recreate the view with updated task aggregation using direct foreign key
    await queryRunner.query(`
            CREATE VIEW "company_wise_project_group_view" AS
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
                   COALESCE(agg_owners.owners, '[]'::json)       AS owners,
                   COALESCE(agg_resources.resources, '[]'::json) AS resources,
                   COALESCE(agg_tasks.tasks, '[]'::json)         AS tasks
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
              -- Aggregation for Resources
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
              -- Aggregation for Tasks (using direct foreign key instead of join table)
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

    // console.log('View updated: company_wise_project_group_view now uses task.projectGroupId');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the updated view
    await queryRunner.query(`
            DROP VIEW IF EXISTS "company_wise_project_group_view" CASCADE
        `);

    // Recreate the old view using the join table (for rollback)
    await queryRunner.query(`
            CREATE VIEW "company_wise_project_group_view" AS
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
                   COALESCE(agg_owners.owners, '[]'::json)       AS owners,
                   COALESCE(agg_resources.resources, '[]'::json) AS resources,
                   COALESCE(agg_tasks.tasks, '[]'::json)         AS tasks
            FROM public.project_group pg
                   JOIN public.company c ON c.id = pg."companyId"
                   LEFT JOIN public.division d ON d.id = pg."divisionId"
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
                   LEFT JOIN (SELECT pgt."projectGroupId",
                                     json_agg(
                                       json_build_object(
                                         'id', t.id,
                                         'name', t.name,
                                         'status', t.status,
                                         'isProject', t."isProject"
                                       ) ORDER BY t.id
                                     ) AS tasks
                              FROM public.project_group_tasks pgt
                                     JOIN public.task t ON t.id = pgt."taskId"
                              GROUP BY pgt."projectGroupId") AS agg_tasks ON agg_tasks."projectGroupId" = pg.id
            ORDER BY pg.id;
        `);

    // console.log('View reverted: company_wise_project_group_view now uses project_group_tasks join table');
  }
}
