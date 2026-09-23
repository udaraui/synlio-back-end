import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecreateProjectGroupView1765192156973
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the view exists
    const viewExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.views 
                WHERE table_schema = 'public' 
                AND table_name = 'company_wise_project_group_view'
            ) as exists
        `);

    if (viewExists[0].exists) {
      console.log(
        'company_wise_project_group_view already exists, skipping creation',
      );
      return;
    }

    console.log('Creating company_wise_project_group_view...');

    // Create the view
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP VIEW IF EXISTS company_wise_project_group_view CASCADE`,
    );
  }
}
