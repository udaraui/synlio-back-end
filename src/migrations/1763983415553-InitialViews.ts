import { MigrationInterface, QueryRunner } from 'typeorm';

// Names of the views being created in the UP migration.
const VIEW_NAMES = [
  'company_wise_project_group_view',
  'company_wise_resource_view',
  'company_wise_resourse_pool_view',
  'company_wise_user_view',
  'user_company_privilege_view',
  'user_company_view',
];

export class InitialViews1763983415553 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing views if they exist (to handle column changes)
    for (const viewName of VIEW_NAMES) {
      await queryRunner.query(`DROP VIEW IF EXISTS ${viewName} CASCADE`);
    }

    // 1
    await queryRunner.query(
      `
          CREATE OR REPLACE VIEW ${VIEW_NAMES[0]} AS
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
        `,
    );

    // 2
    await queryRunner.query(
      `
          CREATE OR REPLACE VIEW ${VIEW_NAMES[1]} AS
          SELECT r.id AS "resourceId",
                 r.first_name,
                 r.last_name,
                 r.email,
                 r.active_status,
                 r."createdBy",
                 r."createdAt",
                 r."updatedBy",
                 r."updatedAt",
                 c.name AS "calendarName",
                 c.id AS "calendarId",
                 d.division,
                 d.id AS "divisionId",
                 cm.id AS "companyId"
          FROM resource r
            LEFT JOIN division d ON r."divisionId" = d.id
            LEFT JOIN calendar c ON r."calendarId" = c.id
            LEFT JOIN company cm ON r."companyId" = cm.id;
        `,
    );

    // 3
    await queryRunner.query(
      `
          CREATE OR REPLACE VIEW ${VIEW_NAMES[2]} AS
          SELECT rp.id AS resource_pool_id,
              rp.name AS resource_pool_name,
              rp."createdAt",
              rp."updatedAt",
              rp."createdBy",
              rp."updatedBy",
              d.id AS division_id,
              d.division AS division_name,
              owner.id AS pool_owner_id,
              owner.first_name AS pool_owner_first_name,
              owner.last_name AS pool_owner_last_name,
              owner.email AS pool_owner_email,
              owner.mobile_number AS pool_owner_mobile,
              json_agg(json_build_object('resourceId', r.id, 'firstName', r.first_name, 'lastName', r.last_name, 'email', r.email, 'divisionId', r."divisionId", 'active', r.active_status) ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL) AS resources
            FROM resource_pool rp
              JOIN company c ON c.id = rp."companyId"
              JOIN division d ON d.id = rp."divisionId"
              LEFT JOIN "user" owner ON owner.id = rp."poolOwnerId"
              LEFT JOIN resource_pool_resources_resource rpr ON rpr."resourcePoolId" = rp.id
              LEFT JOIN resource r ON r.id = rpr."resourceId"
            GROUP BY rp.id, c.id, d.id, owner.id;
        `,
    );

    // 4
    await queryRunner.query(
      `
          CREATE OR REPLACE VIEW ${VIEW_NAMES[3]} AS
          SELECT u.id,
              u."createdAt",
              u."updatedAt",
              u."createdBy",
              u."updatedBy",
              u.first_name,
              u.last_name,
              u.mobile_number,
              u.email,
              u.password,
              u.profile_picture,
              u."hashedRefreshToken",
              u."isActive",
              uc."userId",
              uc."companyId"
            FROM "user" u
              JOIN user_companies_company uc ON u.id = uc."userId"
            ORDER BY u.id;
        `,
    );

    // 5
    await queryRunner.query(
      `
          CREATE OR REPLACE VIEW ${VIEW_NAMES[4]} AS
          SELECT ucr."userId",
              ucr."companyId",
              string_agg(p.access_key::text, ','::text) AS access_key
            FROM user_company_role ucr
              LEFT JOIN role_privileges_privilege rp ON ucr."roleId" = rp."roleId"
              LEFT JOIN privilege p ON rp."privilegeId" = p.id
              LEFT JOIN company c ON c.id = ucr."companyId"
            WHERE c."isActive" = 'active'::company_isactive_enum
            GROUP BY ucr."userId", ucr."companyId";
        `,
    );

    // 6
    await queryRunner.query(
      `
          CREATE OR REPLACE VIEW ${VIEW_NAMES[5]} AS
          SELECT uc."userId",
              c.id AS "companyId",
              c.company_code,
              c.company,
              c.logo,
              c."isActive",
              c."createdAt",
              c."updatedAt",
              c."createdBy",
              c."updatedBy"
            FROM user_companies_company uc
              LEFT JOIN company c ON c.id = uc."companyId";
        `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The down migration safely drops all views created in the up migration.
    for (const viewName of VIEW_NAMES) {
      await queryRunner.query(`DROP VIEW IF EXISTS ${viewName};`);
    }
  }
}
