import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropEmailConfigFromCompany1790000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "notificationEmail"`);
    await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "notificationEmailPassword"`);
    await queryRunner.query(`ALTER TABLE "company" DROP COLUMN IF EXISTS "emailProvider"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "company_emailprovider_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "company_emailprovider_enum" AS ENUM('gmail', 'outlook', 'mail_service')`);
    await queryRunner.query(`ALTER TABLE "company" ADD "emailProvider" "company_emailprovider_enum"`);
    await queryRunner.query(`ALTER TABLE "company" ADD "notificationEmailPassword" character varying`);
    await queryRunner.query(`ALTER TABLE "company" ADD "notificationEmail" character varying`);
  }
}
