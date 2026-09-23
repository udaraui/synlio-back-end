import { MigrationInterface, QueryRunner } from 'typeorm';

export class PulseSchemaUpdates1781600000001 implements MigrationInterface {
  name = 'PulseSchemaUpdates1781600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pulse" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "pulse" ADD "createdBy" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse" ADD "updatedBy" character varying(50)`,
    );
    await queryRunner.query(`ALTER TABLE "pulse_week" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "createdBy" TYPE character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "updatedBy" TYPE character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "updatedBy" TYPE integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ALTER COLUMN "createdBy" TYPE integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse_week" ADD "deletedAt" timestamptz`,
    );
    await queryRunner.query(`ALTER TABLE "pulse" DROP COLUMN "updatedBy"`);
    await queryRunner.query(`ALTER TABLE "pulse" DROP COLUMN "createdBy"`);
    await queryRunner.query(`ALTER TABLE "pulse" ADD "deletedAt" timestamptz`);
  }
}
