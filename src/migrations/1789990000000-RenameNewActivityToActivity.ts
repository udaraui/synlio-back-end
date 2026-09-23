import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameNewActivityToActivity1789990000000 implements MigrationInterface {
    name = 'RenameNewActivityToActivity1789990000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "new_activity" RENAME TO "activity"`);
        await queryRunner.query(`ALTER INDEX "IDX_new_activity_ownerUserId_companyId" RENAME TO "IDX_activity_ownerUserId_companyId"`);
        await queryRunner.query(`ALTER INDEX "IDX_new_activity_ownerUserId_startDate" RENAME TO "IDX_activity_ownerUserId_startDate"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER INDEX "IDX_activity_ownerUserId_startDate" RENAME TO "IDX_new_activity_ownerUserId_startDate"`);
        await queryRunner.query(`ALTER INDEX "IDX_activity_ownerUserId_companyId" RENAME TO "IDX_new_activity_ownerUserId_companyId"`);
        await queryRunner.query(`ALTER TABLE "activity" RENAME TO "new_activity"`);
    }
}
