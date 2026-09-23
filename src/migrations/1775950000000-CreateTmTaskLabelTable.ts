import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTmTaskLabelTable1775950000000 implements MigrationInterface {
  name = 'CreateTmTaskLabelTable1775950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the tm_task_label table (linked to task_space instead of project_group)
    await queryRunner.query(`
      CREATE TABLE "tm_task_label" (
        "id"          SERIAL NOT NULL,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy"   character varying(50),
        "updatedBy"   character varying(50),
        "name"        character varying NOT NULL,
        "taskSpaceId" integer NOT NULL,
        CONSTRAINT "PK_tm_task_label" PRIMARY KEY ("id")
      )
    `);

    // 2. FK: tm_task_label -> task_space
    await queryRunner.query(`
      ALTER TABLE "tm_task_label"
        ADD CONSTRAINT "FK_tm_task_label_taskSpaceId"
          FOREIGN KEY ("taskSpaceId") REFERENCES "task_space"("id")
          ON DELETE CASCADE
    `);

    // 3. Index on taskSpaceId for fast lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_tm_task_label_taskSpaceId"
        ON "tm_task_label" ("taskSpaceId")
    `);

    // 4. Drop the old FK on tm_task_labels_mapping that pointed to task_label
    await queryRunner.query(`
      ALTER TABLE "tm_task_labels_mapping"
        DROP CONSTRAINT IF EXISTS "FK_tm_task_labels_mapping_labelId"
    `);

    // 5. Add new FK on tm_task_labels_mapping pointing to tm_task_label
    await queryRunner.query(`
      ALTER TABLE "tm_task_labels_mapping"
        ADD CONSTRAINT "FK_tm_task_labels_mapping_labelId"
          FOREIGN KEY ("labelId") REFERENCES "tm_task_label"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore old FK pointing back to task_label
    await queryRunner.query(`
      ALTER TABLE "tm_task_labels_mapping"
        DROP CONSTRAINT IF EXISTS "FK_tm_task_labels_mapping_labelId"
    `);

    await queryRunner.query(`
      ALTER TABLE "tm_task_labels_mapping"
        ADD CONSTRAINT "FK_tm_task_labels_mapping_labelId"
          FOREIGN KEY ("labelId") REFERENCES "task_label"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // Drop index and table
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tm_task_label_taskSpaceId"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tm_task_label"
        DROP CONSTRAINT IF EXISTS "FK_tm_task_label_taskSpaceId"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "tm_task_label"`);
  }
}
