import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTmTaskLogTable1778600000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "tm_task_log"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // If you need to support reverting this migration, you would re-create the table here.
        // For this case, we'll leave it empty.
    }
}
