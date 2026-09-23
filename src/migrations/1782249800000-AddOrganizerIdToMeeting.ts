import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizerIdToMeeting1782249800000 implements MigrationInterface {
    name = 'AddOrganizerIdToMeeting1782249800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meeting" ADD "organizerId" integer`);
        await queryRunner.query(`ALTER TABLE "meeting_attendee" ADD "userId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meeting_attendee" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "meeting" DROP COLUMN "organizerId"`);
    }
}
