import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUserFkFromTicketSpaceMember1784950000000 implements MigrationInterface {
    name = 'RemoveUserFkFromTicketSpaceMember1784950000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_space_member" DROP CONSTRAINT IF EXISTS "FK_ticket_permission_user"`);
        await queryRunner.query(`ALTER TABLE "ticket_space_member" DROP CONSTRAINT IF EXISTS "FK_ticket_space_member_user"`);
        await queryRunner.query(`ALTER TABLE "ticket_space_member" DROP CONSTRAINT IF EXISTS "FK_ticket_space_members_user"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "ticket_space_member"
          ADD CONSTRAINT "FK_ticket_permission_user"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
        `);
    }
}
