import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFilterTemplateTable1790100000000 implements MigrationInterface {
  name = 'CreateFilterTemplateTable1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create filter_template table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "filter_template" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "name" character varying(100) NOT NULL,
        "description" character varying(255),
        "type" character varying(20) NOT NULL,
        "visibility" character varying(20) NOT NULL DEFAULT 'PRIVATE',
        "filters" jsonb NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "userId" integer NOT NULL,
        "companyId" integer NOT NULL,
        CONSTRAINT "PK_filter_template_id" PRIMARY KEY ("id")
      )
    `);

    // 2. Add foreign keys to user and company
    await queryRunner.query(`
      ALTER TABLE "filter_template"
      ADD CONSTRAINT "FK_filter_template_userId"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "filter_template"
      ADD CONSTRAINT "FK_filter_template_companyId"
      FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // 3. Create filter_template_shared_users ManyToMany table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "filter_template_shared_users" (
        "templateId" integer NOT NULL,
        "userId" integer NOT NULL,
        CONSTRAINT "PK_filter_template_shared_users" PRIMARY KEY ("templateId", "userId"),
        CONSTRAINT "FK_filter_template_shared_users_templateId"
          FOREIGN KEY ("templateId") REFERENCES "filter_template"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_filter_template_shared_users_userId"
          FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // 4. Create performance indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_filter_template_company_type_visibility"
      ON "filter_template" ("companyId", "type", "visibility")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_filter_template_userId"
      ON "filter_template" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_filter_template_shared_users_userId"
      ON "filter_template_shared_users" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_filter_template_shared_users_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_filter_template_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_filter_template_company_type_visibility"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "filter_template_shared_users"`);
    await queryRunner.query(`ALTER TABLE "filter_template" DROP CONSTRAINT IF EXISTS "FK_filter_template_companyId"`);
    await queryRunner.query(`ALTER TABLE "filter_template" DROP CONSTRAINT IF EXISTS "FK_filter_template_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "filter_template"`);
  }
}
