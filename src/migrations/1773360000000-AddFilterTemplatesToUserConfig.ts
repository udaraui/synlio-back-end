import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFilterTemplatesToUserConfig1773360000000 implements MigrationInterface {

  name = 'AddFilterTemplatesToUserConfig1773360000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_config" ADD "filterTemplates" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_config" DROP COLUMN "filterTemplates"`);
  }

}

