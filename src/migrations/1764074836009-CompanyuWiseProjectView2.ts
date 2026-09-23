import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyuWiseProjectView21764074836009
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE VIEW company_wise_project_view AS
            SELECT p.id,
                   p.name,
                   p.code,
                   p.description,
                   p."createdAt",
                   p."updatedAt",
                   p."createdBy",
                   p."updatedBy",
                   p.status,
                   p.priority,
                   p."startDate",
                   p."endDate",
                   c.id                                          AS "companyId",
                   c.company                                     AS "companyName",
                   c.company_code                                AS "companyCode",
                   d.id                                          AS "divisionId",
                   d.division                                    AS "divisionName",
                   d.division_code                               AS "divisionCode",
                   pg.id                                         AS "projectGroupId",
                   pg.name                                       AS "projectGroupName",
                   pg.prefix                                     AS "projectGroupPrefix",
                   COALESCE(agg_counts.resource_count, 0)        AS "resourceCount",
                   COALESCE(agg_skills.skills, '[]'::json)       AS "skills"
            FROM public.project p
                   JOIN public.project_group pg ON pg.id = p."projectGroupId"
                   JOIN public.company c ON c.id = p."companyId"
                   LEFT JOIN public.division d ON d.id = p."divisionId"
                   LEFT JOIN (
                     SELECT pr."projectId",
                            COUNT(DISTINCT pr."resourceId") AS resource_count
                     FROM public.project_resource_resources pr
                     GROUP BY pr."projectId"
                   ) AS agg_counts ON agg_counts."projectId" = p.id
                   LEFT JOIN (
                     SELECT skill_counts."projectId",
                            json_agg(
                              json_build_object(
                                'skillName', skill_counts.skill_name,
                                'resourceCount', skill_counts.resource_count
                              ) ORDER BY skill_counts.skill_name
                            ) AS skills
                     FROM (
                       SELECT pr."projectId",
                              s.name AS skill_name,
                              COUNT(DISTINCT pr."resourceId") AS resource_count
                       FROM public.project_resource_resources pr
                              JOIN public.resource_skill rs ON rs."resourceId" = pr."resourceId"
                              JOIN public.skill s ON s.id = rs."skillId"
                       GROUP BY pr."projectId", s.name
                     ) AS skill_counts
                     GROUP BY skill_counts."projectId"
                   ) AS agg_skills ON agg_skills."projectId" = p.id
            ORDER BY p.id;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP VIEW company_wise_project_view;
        `);
  }
}
