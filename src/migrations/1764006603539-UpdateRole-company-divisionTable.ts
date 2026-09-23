import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRoleCompanyDivisionTable1764006603539
  implements MigrationInterface
{
  name = 'UpdateRoleCompanyDivisionTable1764006603539';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role" ADD CONSTRAINT "FK_6d29d31feb24503b868472091bc" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role" DROP CONSTRAINT "FK_6d29d31feb24503b868472091bc"`,
    );
  }
}
