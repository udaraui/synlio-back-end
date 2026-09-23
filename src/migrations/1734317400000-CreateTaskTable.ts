import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskTable1734317400000 implements MigrationInterface {
  name = 'CreateTaskTable1734317400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "task" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP,
                "createdBy" character varying,
                "updatedBy" character varying,
                "deletedBy" character varying,
                "code" character varying,
                "name" character varying NOT NULL,
                "description" character varying,
                "status" character varying NOT NULL DEFAULT 'TODO',
                "priority" character varying NOT NULL DEFAULT 'LOW',
                "dueDate" date,
                "completionDate" date,
                "isMiniProject" boolean NOT NULL DEFAULT false,
                "projectId" integer NOT NULL,
                "assigneeId" integer NOT NULL,
                "coAssigneeId" integer,
                CONSTRAINT "PK_fb213f79ee45060ba925ecd576e" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "task_related_tasks" (
                "taskId" integer NOT NULL,
                "relatedTaskId" integer NOT NULL,
                CONSTRAINT "PK_task_related_tasks" PRIMARY KEY ("taskId", "relatedTaskId")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_task_related_tasks_taskId" ON "task_related_tasks" ("taskId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_task_related_tasks_relatedTaskId" ON "task_related_tasks" ("relatedTaskId")
        `);

    await queryRunner.query(`
            ALTER TABLE "task"
            ADD CONSTRAINT "FK_task_projectId"
            FOREIGN KEY ("projectId")
            REFERENCES "project"("id")
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "task"
            ADD CONSTRAINT "FK_task_assigneeId"
            FOREIGN KEY ("assigneeId")
            REFERENCES "resource"("id")
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "task"
            ADD CONSTRAINT "FK_task_coAssigneeId"
            FOREIGN KEY ("coAssigneeId")
            REFERENCES "resource"("id")
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            ALTER TABLE "task_related_tasks"
            ADD CONSTRAINT "FK_task_related_tasks_taskId"
            FOREIGN KEY ("taskId")
            REFERENCES "task"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "task_related_tasks"
            ADD CONSTRAINT "FK_task_related_tasks_relatedTaskId"
            FOREIGN KEY ("relatedTaskId")
            REFERENCES "task"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_related_tasks" DROP CONSTRAINT "FK_task_related_tasks_relatedTaskId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_related_tasks" DROP CONSTRAINT "FK_task_related_tasks_taskId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task" DROP CONSTRAINT "FK_task_coAssigneeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task" DROP CONSTRAINT "FK_task_assigneeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task" DROP CONSTRAINT "FK_task_projectId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_task_related_tasks_relatedTaskId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_task_related_tasks_taskId"`,
    );
    await queryRunner.query(`DROP TABLE "task_related_tasks"`);
    await queryRunner.query(`DROP TABLE "task"`);
  }
}
