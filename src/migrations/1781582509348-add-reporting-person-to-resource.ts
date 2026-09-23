import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReportingPersonToResource1781582509348 implements MigrationInterface {
    name = 'AddReportingPersonToResource1781582509348'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "resource" ADD "reportingPersonId" integer`);
        }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "resource" DROP COLUMN "reportingPersonId"`);
       }

}
