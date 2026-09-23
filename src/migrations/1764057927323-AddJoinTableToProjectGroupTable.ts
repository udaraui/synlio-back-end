import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJoinTableToProjectGroupTable1764057927323
  implements MigrationInterface
{
  name = 'AddJoinTableToProjectGroupTable1764057927323';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns exist before dropping them
    const calendarTable = await queryRunner.getTable('calendar');
    if (calendarTable) {
      if (calendarTable.findColumnByName('test')) {
        await queryRunner.query(`ALTER TABLE "calendar" DROP COLUMN "test"`);
      }
      if (calendarTable.findColumnByName('test2')) {
        await queryRunner.query(`ALTER TABLE "calendar" DROP COLUMN "test2"`);
      }
      if (calendarTable.findColumnByName('test3')) {
        await queryRunner.query(`ALTER TABLE "calendar" DROP COLUMN "test3"`);
      }
    }

    // Check if table doesn't exist before creating
    const projectResourceTableExists = await queryRunner.hasTable(
      'project_resource_resources',
    );
    if (!projectResourceTableExists) {
      await queryRunner.query(
        `CREATE TABLE "project_resource_resources" ("projectId" uuid NOT NULL,"resourceId" uuid NOT NULL,CONSTRAINT "PK_project_resource_resources" PRIMARY KEY ("projectId", "resourceId"))`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "project_resource_resources"`);
    await queryRunner.query(
      `ALTER TABLE "calendar" ADD "test3" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar" ADD "test2" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar" ADD "test" character varying`,
    );
  }
}
