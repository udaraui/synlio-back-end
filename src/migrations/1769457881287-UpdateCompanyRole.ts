import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCompanyRole1769457881287 implements MigrationInterface {
  name = 'UpdateCompanyRole1769457881287';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop the existing constraint first
    await queryRunner.query(
      `ALTER TABLE "user_company_role" DROP CONSTRAINT "FK_3263eb3ba79b6da347f066c16ab"`,
    );

    // 2. Add it back with ON DELETE CASCADE
    await queryRunner.query(`ALTER TABLE "user_company_role" 
        ADD CONSTRAINT "FK_3263eb3ba79b6da347f066c16ab" 
        FOREIGN KEY ("userId") REFERENCES "user" ("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // To reverse this, drop the cascade version and add back the original (standard) one
    await queryRunner.query(
      `ALTER TABLE "user_company_role" DROP CONSTRAINT "FK_3263eb3ba79b6da347f066c16ab"`,
    );

    await queryRunner.query(`ALTER TABLE "user_company_role" 
        ADD CONSTRAINT "FK_3263eb3ba79b6da347f066c16ab" 
        FOREIGN KEY ("userId") REFERENCES "user" ("id") 
        ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }
}
