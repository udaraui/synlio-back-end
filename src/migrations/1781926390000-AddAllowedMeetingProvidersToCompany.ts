import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllowedMeetingProvidersToCompany1781926390000 implements MigrationInterface {
    name = 'AddAllowedMeetingProvidersToCompany1781926390000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company" ADD "allowedMeetingProviders" text DEFAULT 'teams,zoom,google_meet'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "allowedMeetingProviders"`);
    }
}
