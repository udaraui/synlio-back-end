import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyCrmTable1792300000000 implements MigrationInterface {
  name = 'CreateCompanyCrmTable1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "company_crm" (
        "id" SERIAL NOT NULL,
        "company_id" integer NOT NULL,
        "employee_count" character varying,
        "manage_type" character varying,
        "optional_data" character varying,
        CONSTRAINT "UQ_company_crm_company_id" UNIQUE ("company_id"),
        CONSTRAINT "PK_company_crm" PRIMARY KEY ("id"),
        CONSTRAINT "FK_company_crm_company" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_crm"`);
  }
}

