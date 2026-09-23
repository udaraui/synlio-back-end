import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTestTable1763983153365 implements MigrationInterface {
  name = 'AddTestTable1763983153365';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table doesn't exist before creating
    const tableExists = await queryRunner.hasTable('test_entity');
    if (!tableExists) {
      await queryRunner.query(
        `CREATE TABLE "test_entity" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying(50), "updatedBy" character varying(50), "name" character varying, "description" character varying, CONSTRAINT "PK_cc0413536e3afc0e586996bea40" PRIMARY KEY ("id"))`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "test_entity"`);
  }
}
