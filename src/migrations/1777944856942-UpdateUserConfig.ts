import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserConfig1777944856942 implements MigrationInterface {
    name = 'UpdateUserConfig1777944856942'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_config" ADD "quickActionConfig" jsonb`);
        }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_config" DROP COLUMN "quickActionConfig"`);}

}
