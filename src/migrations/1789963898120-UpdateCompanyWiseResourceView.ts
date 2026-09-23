import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCompanyWiseResourceView1789963898120 implements MigrationInterface {
    name = 'UpdateCompanyWiseResourceView1789963898120'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS "company_wise_resource_view"`);
        await queryRunner.query(`
            CREATE VIEW "company_wise_resource_view" AS
            SELECT
                r.id AS "resourceId",
                r.first_name,
                r.last_name,
                r.email,
                r.mobile,
                r.profile_pic,
                r.active_status,
                r.type,
                r."createdBy",
                r."createdAt",
                r."updatedBy",
                r."updatedAt",
                c.name AS "calendarName",
                c.id AS "calendarId",
                d.division,
                d.id AS "divisionId",
                r."companyId" AS "companyId",
                COALESCE(
                        '|' || STRING_AGG(rp.id::text, '|') || '|',
                        ''
                ) AS "resourcePoolIdsText",
                COALESCE(
                        JSONB_AGG(
                                JSONB_BUILD_OBJECT(
                                        'pool_id', rp.id,
                                        'pool_name', rp.name
                                )
                        ) FILTER (WHERE rp.id IS NOT NULL),
                        '[]'::jsonb
                ) AS "resourcePools",
                CASE 
                    WHEN rp_person.id IS NOT NULL THEN
                        JSONB_BUILD_OBJECT(
                            'id', rp_person.id,
                            'first_name', rp_person.first_name,
                            'last_name', rp_person.last_name,
                            'email', rp_person.email
                        )
                    ELSE NULL
                END AS "reportingPerson"
            FROM
                public.resource r
                    LEFT JOIN public.division d ON r."divisionId" = d.id
                    LEFT JOIN public.calendar c ON r."calendarId" = c.id
                    LEFT JOIN public.resource rp_person ON r."reportingPersonId" = rp_person.id
                    LEFT JOIN public.resource_pool_resources_resource rpr ON r.id = rpr."resourceId"
                    LEFT JOIN public.resource_pool rp ON rpr."resourcePoolId" = rp.id
            GROUP BY
                r.id, r.first_name, r.last_name, r.email, r.mobile, r.profile_pic,
                r.active_status, r.type, r."createdBy", r."createdAt", r."updatedBy", r."updatedAt",
                c.name, c.id, d.division, d.id,
                rp_person.id, rp_person.first_name, rp_person.last_name, rp_person.email
            ORDER BY
                r.id;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS "company_wise_resource_view"`);
        await queryRunner.query(`
            CREATE VIEW "company_wise_resource_view" AS
            SELECT
                r.id AS "resourceId",
                r.first_name,
                r.last_name,
                r.email,
                r.mobile,
                r.profile_pic,
                r.active_status,
                r.type,
                r."createdBy",
                r."createdAt",
                r."updatedBy",
                r."updatedAt",
                c.name AS "calendarName",
                c.id AS "calendarId",
                d.division,
                d.id AS "divisionId",
                r.companyId AS "companyId",
                COALESCE(
                        '|' || STRING_AGG(rp.id::text, '|') || '|',
                        ''
                ) AS "resourcePoolIdsText",
                COALESCE(
                        JSONB_AGG(
                                JSONB_BUILD_OBJECT(
                                        'pool_id', rp.id,
                                        'pool_name', rp.name
                                )
                        ) FILTER (WHERE rp.id IS NOT NULL),
                        '[]'::jsonb
                ) AS "resourcePools"
            FROM
                public.resource r
                    LEFT JOIN public.division d ON r."divisionId" = d.id
                    LEFT JOIN public.calendar c ON r."calendarId" = c.id
                    LEFT JOIN public.resource_pool_resources_resource rpr ON r.id = rpr."resourceId"
                    LEFT JOIN public.resource_pool rp ON rpr."resourcePoolId" = rp.id
            GROUP BY
                r.id, r.first_name, r.last_name, r.email, r.mobile, r.profile_pic,
                r.active_status, r.type, r."createdBy", r."createdAt", r."updatedBy", r."updatedAt",
                c.name, c.id, d.division, d.id
            ORDER BY
                r.id;
        `);
    }
}
