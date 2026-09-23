import { MigrationInterface, QueryRunner } from "typeorm";



export class AddFilterPreference1773121454574 implements MigrationInterface {

  name = 'AddFilterPreference1773121454574'



  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`ALTER TABLE "user_config" ADD "filterPreference" jsonb`);

  }



  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`ALTER TABLE "user_config" DROP COLUMN "filterPreference"`);

  }



}