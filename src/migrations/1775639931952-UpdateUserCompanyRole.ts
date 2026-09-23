import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserCompanyRole1775639931952 implements MigrationInterface {
    name = 'UpdateUserCompanyRole1775639931952'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_company_role" ALTER COLUMN "companyId" DROP NOT NULL`);
       }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_company_role" ALTER COLUMN "companyId" SET NOT NULL`);
       }

}
