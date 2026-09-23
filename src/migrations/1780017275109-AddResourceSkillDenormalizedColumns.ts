import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResourceSkillDenormalizedColumns1780017275109 implements MigrationInterface {
  name = 'AddResourceSkillDenormalizedColumns1780017275109';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new denormalized columns to resource_skill table
    await queryRunner.query(`ALTER TABLE "resource_skill" ADD "skillName" character varying`);
    await queryRunner.query(`ALTER TABLE "resource_skill" ADD "skillLevelName" character varying`);
    await queryRunner.query(`ALTER TABLE "resource_skill" ADD "starCount" integer`);
    await queryRunner.query(`ALTER TABLE "resource_skill" ADD "skillCategoryName" character varying`);
    await queryRunner.query(`ALTER TABLE "resource_skill" ADD "companyId" integer`);

    // Populate the new columns for existing records using a subquery
    await queryRunner.query(`
      UPDATE "resource_skill" rs
      SET
        "skillName" = sub.skill_name,
        "skillLevelName" = sub.level_name,
        "starCount" = sub.star_count,
        "skillCategoryName" = sub.category_name,
        "companyId" = sub.company_id
      FROM (
        SELECT
          rs.id AS rs_id,
          s.name AS skill_name,
          sl.name AS level_name,
          sl.star_count AS star_count,
          sc.name AS category_name,
          r."companyId" AS company_id
        FROM "resource_skill" rs
        LEFT JOIN "resource" r ON rs."resourceId" = r.id
        LEFT JOIN "skill" s ON rs."skillId" = s.id
        LEFT JOIN "skill_level" sl ON rs."skillLevelId" = sl.id
        LEFT JOIN "skill_categories" sc ON rs."skillCategoryId" = sc.id
      ) sub
      WHERE rs.id = sub.rs_id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop denormalized columns from resource_skill table
    await queryRunner.query(`ALTER TABLE "resource_skill" DROP COLUMN "companyId"`);
    await queryRunner.query(`ALTER TABLE "resource_skill" DROP COLUMN "skillCategoryName"`);
    await queryRunner.query(`ALTER TABLE "resource_skill" DROP COLUMN "starCount"`);
    await queryRunner.query(`ALTER TABLE "resource_skill" DROP COLUMN "skillLevelName"`);
    await queryRunner.query(`ALTER TABLE "resource_skill" DROP COLUMN "skillName"`);
  }
}
