import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCompanyIdToTicketTemplate1788960958697 implements MigrationInterface {
    name = 'AddCompanyIdToTicketTemplate1788960958697'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_template" ADD "companyId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_template" DROP COLUMN "companyId"`);
    }
}
