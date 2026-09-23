import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateResourcePool1765259119282 implements MigrationInterface {
  name = 'UpdateResourcePool1765259119282';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the new column
    await queryRunner.query(
      `ALTER TABLE "resource_pool" ADD "isActive" boolean NOT NULL DEFAULT true`,
    );

    // 2. Drop the existing view (Ignore if it doesn't exist)
    await queryRunner.query(
      `DROP VIEW IF EXISTS "company_wise_resourse_pool_view"`,
    );

    // 3. Delete TypeORM metadata for the old view (Crucial for a clean slate)
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "name" = 'company_wise_resourse_pool_view'`,
    );

    // 4. Create the NEW view with the updated definition
    // Note: The new view definition correctly includes rp."isActive"
    await queryRunner.query(`CREATE VIEW "company_wise_resourse_pool_view" AS 
        SELECT
           rp.id                              AS resource_pool_id,
           rp.name                            AS resource_pool_name,
           rp."isActive",
           rp."createdAt",
           rp."updatedAt",
           rp."createdBy",
           rp."updatedBy",
           d.id                               AS division_id,
           d.division                         AS division_name,
           owner.id                           AS pool_owner_id,
           owner.first_name                   AS pool_owner_first_name,
           owner.last_name                    AS pool_owner_last_name,
           owner.email                        AS pool_owner_email,
           owner.mobile_number                AS pool_owner_mobile,
           json_agg(
             json_build_object(
               'resourceId', r.id,
               'firstName',  r.first_name,
               'lastName',   r.last_name,
               'email',      r.email,
               'divisionId', r."divisionId",
               'active',     r.active_status
             ) ORDER BY r.id
           ) FILTER (WHERE r.id IS NOT NULL)   AS resources
         FROM public.resource_pool rp
         JOIN public.company c
           ON c.id = rp."companyId"
         JOIN public.division d
           ON d.id = rp."divisionId"
         LEFT JOIN public."user" owner
           ON owner.id = rp."poolOwnerId"
         LEFT JOIN public.resource_pool_resources_resource rpr
           ON rpr."resourcePoolId" = rp.id
         LEFT JOIN public.resource r
           ON r.id = rpr."resourceId"
         GROUP BY
           rp.id,
           c.id,
           d.id,
           owner.id;
    `);

    // 5. Insert the metadata for the newly created view
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'VIEW',
        'company_wise_resourse_pool_view',
        ` SELECT
        rp.id                              AS resource_pool_id,
        rp.name                            AS resource_pool_name,
        rp."isActive",
        rp."createdAt",
        rp."updatedAt",
        rp."createdBy",
        rp."updatedBy",
        d.id                               AS division_id,
        d.division                         AS division_name,
        owner.id                           AS pool_owner_id,
        owner.first_name                   AS pool_owner_first_name,
        owner.last_name                    AS pool_owner_last_name,
        owner.email                        AS pool_owner_email,
        owner.mobile_number                AS pool_owner_mobile,
        json_agg(
          json_build_object(
            'resourceId', r.id,
            'firstName',  r.first_name,
            'lastName',   r.last_name,
            'email',      r.email,
            'divisionId', r."divisionId",
            'active',     r.active_status
          ) ORDER BY r.id
        ) FILTER (WHERE r.id IS NOT NULL)   AS resources
      FROM public.resource_pool rp
      JOIN public.company c
        ON c.id = rp."companyId"
      JOIN public.division d
        ON d.id = rp."divisionId"
      LEFT JOIN public."user" owner
        ON owner.id = rp."poolOwnerId"
      LEFT JOIN public.resource_pool_resources_resource rpr
        ON rpr."resourcePoolId" = rp.id
      LEFT JOIN public.resource r
        ON r.id = rpr."resourceId"
      GROUP BY
        rp.id,
        c.id,
        d.id,
        owner.id;
        `,
      ],
    );
  } // <-- This is where the extra '}' was, causing the error.

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Delete view metadata
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['VIEW', 'company_wise_resourse_pool_view', 'public'],
    );

    // 2. Drop the view
    await queryRunner.query(`DROP VIEW "company_wise_resourse_pool_view"`);

    // 3. Drop the column
    await queryRunner.query(
      `ALTER TABLE "resource_pool" DROP COLUMN "isActive"`,
    );
  }
}
