import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskAttachment1771288226283 implements MigrationInterface {
  name = 'AddTaskAttachment1771288226283';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "task_attachment" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying(50), "updatedBy" character varying(50), "link" text NOT NULL, "taskId" integer NOT NULL, CONSTRAINT "PK_b9dd4c7184d6c02636decffa219" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_attachment" DROP CONSTRAINT "FK_af192cfe21f9fde89a37adb7700"`,
    );
  }
}
