import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusSeverityToTaskSpace1775100000000
  implements MigrationInterface
{
  name = 'AddStatusSeverityToTaskSpace1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // task_space_status — includes sequence column for drag-and-drop ordering
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_space_status" (
        "taskSpaceId" integer NOT NULL,
        "statusId"    integer NOT NULL,
        "sequence"    integer,
        CONSTRAINT "PK_task_space_status" PRIMARY KEY ("taskSpaceId", "statusId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_status"
        ADD CONSTRAINT "FK_task_space_status_taskSpace"
        FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_status"
        ADD CONSTRAINT "FK_task_space_status_status"
        FOREIGN KEY ("statusId") REFERENCES "status"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // task_space_severity
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_space_severity" (
        "taskSpaceId" integer NOT NULL,
        "severityId"  integer NOT NULL,
        CONSTRAINT "PK_task_space_severity" PRIMARY KEY ("taskSpaceId", "severityId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_severity"
        ADD CONSTRAINT "FK_task_space_severity_taskSpace"
        FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "task_space_severity"
        ADD CONSTRAINT "FK_task_space_severity_severity"
        FOREIGN KEY ("severityId") REFERENCES "severity"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "task_space_severity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_space_status"`);
  }
}

