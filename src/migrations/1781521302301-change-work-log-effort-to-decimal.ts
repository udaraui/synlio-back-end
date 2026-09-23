import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeWorkLogEffortToDecimal1781521302301 implements MigrationInterface {
    name = 'ChangeWorkLogEffortToDecimal1781521302301'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "work_log" DROP COLUMN "effort"`);
        await queryRunner.query(`ALTER TABLE "work_log" ADD "effort" numeric(10,2) NOT NULL DEFAULT '0'`);
       }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "work_log" DROP COLUMN "effort"`);
         }

}
