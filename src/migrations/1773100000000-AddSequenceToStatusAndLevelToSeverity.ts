import { MigrationInterface, QueryRunner } from 'typeorm';
export class DropUniqueFromStatusAndSeverityName1773100000000
  implements MigrationInterface
{
  name = 'DropUniqueFromStatusAndSeverityName1773100000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "status" DROP CONSTRAINT "UQ_status_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "severity" DROP CONSTRAINT "UQ_severity_name"`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "severity" ADD CONSTRAINT "UQ_severity_name" UNIQUE ("name")`,
    );
    await queryRunner.query(
      `ALTER TABLE "status" ADD CONSTRAINT "UQ_status_name" UNIQUE ("name")`,
    );
  }
}
