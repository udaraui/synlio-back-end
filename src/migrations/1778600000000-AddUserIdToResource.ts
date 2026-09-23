import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToResource1778600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resource" ADD "userId" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resource" DROP COLUMN "userId"`,
    );
  }
}