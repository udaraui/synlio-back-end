import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRole1775631901679 implements MigrationInterface {
    name = 'UpdateRole1775631901679'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role" ALTER COLUMN "companyId" DROP NOT NULL`); }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role" ALTER COLUMN "companyId" SET NOT NULL`);
       }

}
