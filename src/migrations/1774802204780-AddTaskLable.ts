import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskLable1774802204780 implements MigrationInterface {
    name = 'AddTaskLable1774802204780'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`
        CREATE TABLE "task_label" (
                                      "id" SERIAL NOT NULL,
                                      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                                      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                                      "createdBy" character varying(50),
                                      "updatedBy" character varying(50),
                                      "name" character varying NOT NULL,
                                      "projectGroupId" integer NOT NULL,
                                      CONSTRAINT "PK_task_label" PRIMARY KEY ("id")
        )
    `);

      // 2. Create the junction table for the ManyToMany relationship
      await queryRunner.query(`
        CREATE TABLE "task_labels_mapping" (
                                               "taskId" integer NOT NULL,
                                               "labelId" integer NOT NULL,
                                               CONSTRAINT "PK_task_labels_mapping" PRIMARY KEY ("taskId", "labelId")
        )
    `);

      // 3. Create indices for performance on junction table
      await queryRunner.query(`
        CREATE INDEX "IDX_task_labels_mapping_taskId" ON "task_labels_mapping" ("taskId")
    `);

      await queryRunner.query(`
        CREATE INDEX "IDX_task_labels_mapping_labelId" ON "task_labels_mapping" ("labelId")
    `);

      // 4. Add Foreign Key for TaskLabel -> ProjectGroup
      await queryRunner.query(`
        ALTER TABLE "task_label"
            ADD CONSTRAINT "FK_task_label_projectGroupId"
                FOREIGN KEY ("projectGroupId") REFERENCES "project_group"("id") ON DELETE CASCADE
    `);

      // 5. Add Foreign Keys for the junction table
      await queryRunner.query(`
        ALTER TABLE "task_labels_mapping"
            ADD CONSTRAINT "FK_task_labels_mapping_taskId"
                FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);

      await queryRunner.query(`
        ALTER TABLE "task_labels_mapping"
            ADD CONSTRAINT "FK_task_labels_mapping_labelId"
                FOREIGN KEY ("labelId") REFERENCES "task_label"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`ALTER TABLE "task_labels_mapping" DROP CONSTRAINT "FK_task_labels_mapping_labelId"`);
      await queryRunner.query(`ALTER TABLE "task_labels_mapping" DROP CONSTRAINT "FK_task_labels_mapping_taskId"`);
      await queryRunner.query(`ALTER TABLE "task_label" DROP CONSTRAINT "FK_task_label_projectGroupId"`);

      // 2. Drop Indices
      await queryRunner.query(`DROP INDEX "IDX_task_labels_mapping_labelId"`);
      await queryRunner.query(`DROP INDEX "IDX_task_labels_mapping_taskId"`);

      // 3. Drop Tables
      await queryRunner.query(`DROP TABLE "task_labels_mapping"`);
      await queryRunner.query(`DROP TABLE "task_label"`);
      }

}
