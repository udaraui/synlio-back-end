import { MigrationInterface, QueryRunner } from "typeorm";

export class DropEmptyTicketSpaceMembersTable1784949364653 implements MigrationInterface {
    name = 'DropEmptyTicketSpaceMembersTable1784949364653'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_space_members" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }
}
