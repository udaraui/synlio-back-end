import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePulseTypeEnum1781600000002 implements MigrationInterface {
  name = 'UpdatePulseTypeEnum1781600000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."pulse_type_enum" RENAME TO "pulse_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pulse_type_enum" AS ENUM('Synlio Activity', 'Need Attention', 'Meeting Time')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse" ALTER COLUMN "pulseType" TYPE "public"."pulse_type_enum" USING "pulseType"::text::"public"."pulse_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."pulse_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."pulse_type_enum" RENAME TO "pulse_type_enum_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pulse_type_enum" AS ENUM('INDIVIDUAL', 'PROJECT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pulse" ALTER COLUMN "pulseType" TYPE "public"."pulse_type_enum" USING "pulseType"::text::"public"."pulse_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."pulse_type_enum_new"`);
  }
}
