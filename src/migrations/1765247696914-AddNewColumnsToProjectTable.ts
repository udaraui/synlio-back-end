import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewColumnsToProjectTable1765247696914
  implements MigrationInterface
{
  name = 'AddNewColumnsToProjectTable1765247696914';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ADD "code" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "project" ADD "assigneeId" integer`);
    await queryRunner.query(`ALTER TABLE "project" ADD "coAssigneeId" integer`);
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "FK_cd26cce59cec82bb0ea5a266618" FOREIGN KEY ("assigneeId") REFERENCES "resource"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "FK_57ec3c7c04a315b89bcd0b8c4fb" FOREIGN KEY ("coAssigneeId") REFERENCES "resource"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_57ec3c7c04a315b89bcd0b8c4fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_cd26cce59cec82bb0ea5a266618"`,
    );
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "coAssigneeId"`);
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "assigneeId"`);
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN "code"`);
  }
}
