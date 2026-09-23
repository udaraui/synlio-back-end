import { MigrationInterface, QueryRunner } from "typeorm";

export class DropExtraProjectManagementTables1782876435976 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "task_event" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "task_checklist_item" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "task_label" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "task_labels_mapping" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
