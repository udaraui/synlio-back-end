import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTmTaskLabelsMapping1775900000000 implements MigrationInterface {
  name = 'AddTmTaskLabelsMapping1775900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Junction table for tm_task <-> task_label
    await queryRunner.query(`
      CREATE TABLE "tm_task_labels_mapping" (
        "taskId"  integer NOT NULL,
        "labelId" integer NOT NULL,
        CONSTRAINT "PK_tm_task_labels_mapping" PRIMARY KEY ("taskId", "labelId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tm_task_labels_mapping_taskId"
        ON "tm_task_labels_mapping" ("taskId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tm_task_labels_mapping_labelId"
        ON "tm_task_labels_mapping" ("labelId")
    `);

    await queryRunner.query(`
      ALTER TABLE "tm_task_labels_mapping"
        ADD CONSTRAINT "FK_tm_task_labels_mapping_taskId"
          FOREIGN KEY ("taskId") REFERENCES "tm_task"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "tm_task_labels_mapping"
        ADD CONSTRAINT "FK_tm_task_labels_mapping_labelId"
          FOREIGN KEY ("labelId") REFERENCES "task_label"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tm_task_labels_mapping" DROP CONSTRAINT "FK_tm_task_labels_mapping_labelId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tm_task_labels_mapping" DROP CONSTRAINT "FK_tm_task_labels_mapping_taskId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_tm_task_labels_mapping_labelId"`);
    await queryRunner.query(`DROP INDEX "IDX_tm_task_labels_mapping_taskId"`);
    await queryRunner.query(`DROP TABLE "tm_task_labels_mapping"`);
  }
}
