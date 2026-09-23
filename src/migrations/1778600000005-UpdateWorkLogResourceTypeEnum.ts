import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateWorkLogResourceTypeEnum1778600000005
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."assignee_type_enum" AS ENUM('ASSIGNEE', 'SUB_ASSIGNEE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_log" ALTER COLUMN "resourceType" TYPE "public"."assignee_type_enum" USING "resourceType"::"text"::"public"."assignee_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."work_log_resourcetype_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."work_log_resourcetype_enum" AS ENUM('ASSIGNEE', 'SUB_ASSIGNEE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_log" ALTER COLUMN "resourceType" TYPE "public"."work_log_resourcetype_enum" USING "resourceType"::"text"::"public"."work_log_resourcetype_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."assignee_type_enum"`);
  }
}