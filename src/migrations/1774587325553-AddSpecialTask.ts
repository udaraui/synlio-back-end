import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpecialTask1774587325553 implements MigrationInterface {
    name = 'AddSpecialTask1774587325553'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task" ADD "special" boolean NOT NULL DEFAULT false`);
       }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "special"`);
    }

}
