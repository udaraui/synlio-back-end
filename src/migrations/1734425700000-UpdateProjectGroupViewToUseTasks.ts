import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProjectGroupViewToUseTasks1734425700000
  implements MigrationInterface
{
  name = 'UpdateProjectGroupViewToUseTasks1734425700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing view
    await queryRunner.query(`
            DROP VIEW IF EXISTS "company_wise_project_group_view" CASCADE
        `);

    // Recreate the view with tasks instead of projects
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
              -- Aggregation for Tasks (using direct foreign key)
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
                                         'completionDate', t."completionDate"
                                       ) ORDER BY t.id
                                     ) AS tasks
                              FROM public.task t
                              GROUP BY t."projectGroupId") AS agg_tasks ON agg_tasks."projectGroupId" = pg.id
            ORDER BY pg.id;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the tasks-based view
    await queryRunner.query(`
            DROP VIEW IF EXISTS "company_wise_project_group_view" CASCADE
        `);

    // Recreate the old view with projects
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
                   COALESCE(agg_projects.projects, '[]'::json)   AS projects
            FROM project_group pg
                   JOIN company c ON c.id = pg."companyId"
                   LEFT JOIN division d ON d.id = pg."divisionId"
                   LEFT JOIN (SELECT pgo."projectGroupId",
                                     json_agg(json_build_object('id', u.id, 'first_name', u.first_name, 'last_name',
                                                                u.last_name, 'email', u.email) ORDER BY u.id) AS owners
                              FROM project_group_owners pgo
                                     JOIN "user" u ON u.id = pgo."userId"
                              GROUP BY pgo."projectGroupId") agg_owners ON agg_owners."projectGroupId" = pg.id
                   LEFT JOIN (SELECT pgr."projectGroupId",
                                     json_agg(json_build_object('id', r.id, 'first_name', r.first_name, 'last_name',
                                                                r.last_name, 'email', r.email, 'active_status',
                                                                r.active_status) ORDER BY r.id) AS resources
                              FROM project_group_resources pgr
                                     JOIN resource r ON r.id = pgr."resourceId"
                              GROUP BY pgr."projectGroupId") agg_resources ON agg_resources."projectGroupId" = pg.id
                   LEFT JOIN (SELECT p."projectGroupId",
                                     json_agg(json_build_object('id', p.id, 'name', p.name, 'status', p.status) ORDER BY p.id) AS projects
                              FROM project p
                              GROUP BY p."projectGroupId") agg_projects ON agg_projects."projectGroupId" = pg.id
            ORDER BY pg.id;
        `);
  }
}
