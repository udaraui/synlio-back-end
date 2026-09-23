import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetTokenToUser1780100000000
  implements MigrationInterface
{
  name = 'AddPasswordResetTokenToUser1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "passwordResetToken" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "passwordResetTokenExpiry" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "passwordResetTokenExpiry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "passwordResetToken"`,
    );
  }
}
