import { MigrationInterface, QueryRunner } from "typeorm";

export class DropProjectManagementTables1782876435975 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "task_attachment" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "task_type" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "task_related_tasks" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "task_co_assignees_resource" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "task_members_resource" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "task" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group_structure_hdr_dtl" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group_structure_dtl" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group_structure_hdr" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group_custom_structure" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group_divisions_division" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group_owners" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group_resources" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group_resources_resource" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "project_group" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
