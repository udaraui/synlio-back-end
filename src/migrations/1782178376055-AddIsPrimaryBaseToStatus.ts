import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsPrimaryBaseToStatus1782178376055 implements MigrationInterface {
    name = 'AddIsPrimaryBaseToStatus1782178376055'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "status" ADD "isPrimaryBase" boolean DEFAULT null`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "status" DROP COLUMN "isPrimaryBase"`);
    }
}
