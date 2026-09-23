import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorTicketPermissionToSpaceMember1784948007952 implements MigrationInterface {
    name = 'RefactorTicketPermissionToSpaceMember1784948007952'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Rename the main table
        await queryRunner.query(`ALTER TABLE "ticket_permission" RENAME TO "ticket_space_member"`);
        
        // 2. Rename the queue join table
        await queryRunner.query(`ALTER TABLE "ticket_permission_queue" RENAME TO "ticket_space_member_queue"`);
        
        // 3. Rename columns from permissionId to memberId
        await queryRunner.query(`ALTER TABLE "ticket_space_member_queue" RENAME COLUMN "permissionId" TO "memberId"`);
        await queryRunner.query(`ALTER TABLE "ticket_participants" RENAME COLUMN "permissionId" TO "memberId"`);
    
        // 4. Drop the obsolete roles join table
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_permission_role" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Rename columns back
        await queryRunner.query(`ALTER TABLE "ticket_space_member_queue" RENAME COLUMN "memberId" TO "permissionId"`);
        await queryRunner.query(`ALTER TABLE "ticket_participants" RENAME COLUMN "memberId" TO "permissionId"`);
        
        // 2. Rename tables back
        await queryRunner.query(`ALTER TABLE "ticket_space_member_queue" RENAME TO "ticket_permission_queue"`);
        await queryRunner.query(`ALTER TABLE "ticket_space_member" RENAME TO "ticket_permission"`);
    
        // 3. Recreate the roles join table
        await queryRunner.query(`
          CREATE TABLE "ticket_permission_role" (
            "permissionId" integer NOT NULL,
            "roleId" integer NOT NULL,
            CONSTRAINT "PK_ticket_permission_role" PRIMARY KEY ("permissionId", "roleId")
          )
        `);
    }
}
