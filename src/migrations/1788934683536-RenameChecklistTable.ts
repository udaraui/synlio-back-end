import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameChecklistTable1788934683536 implements MigrationInterface {
    name = 'RenameChecklistTable1788934683536';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Rename table
        await queryRunner.query(`ALTER TABLE "tm_checklist" RENAME TO "checklist"`);

        // Rename auto-increment sequence
        await queryRunner.query(`ALTER SEQUENCE IF EXISTS "tm_checklist_id_seq" RENAME TO "checklist_id_seq"`);

        // Rename constraints and indices
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_tm_checklist_entity" RENAME TO "IDX_checklist_entity"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_tm_checklist_assignee" RENAME TO "IDX_checklist_assignee"`);
        await queryRunner.query(`ALTER TABLE "checklist" RENAME CONSTRAINT "PK_tm_checklist" TO "PK_checklist"`);
        await queryRunner.query(`ALTER TABLE "checklist" RENAME CONSTRAINT "CHK_tm_checklist_entityType" TO "CHK_checklist_entityType"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert constraints and indices
        await queryRunner.query(`ALTER TABLE "checklist" RENAME CONSTRAINT "CHK_checklist_entityType" TO "CHK_tm_checklist_entityType"`);
        await queryRunner.query(`ALTER TABLE "checklist" RENAME CONSTRAINT "PK_checklist" TO "PK_tm_checklist"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_checklist_assignee" RENAME TO "IDX_tm_checklist_assignee"`);
        await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_checklist_entity" RENAME TO "IDX_tm_checklist_entity"`);

        // Revert sequence
        await queryRunner.query(`ALTER SEQUENCE IF EXISTS "checklist_id_seq" RENAME TO "tm_checklist_id_seq"`);

        // Revert table name
        await queryRunner.query(`ALTER TABLE "checklist" RENAME TO "tm_checklist"`);
    }
}
