import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsActiveToTicketSpace1789573486259 implements MigrationInterface {
    name = 'AddIsActiveToTicketSpace1789573486259'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_space" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_space" DROP COLUMN "isActive"`);
    }
}
