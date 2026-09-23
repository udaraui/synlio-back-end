import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskTypeTable1734425400000 implements MigrationInterface {
  name = 'CreateTaskTypeTable1734425400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "task_type" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "createdBy" character varying(50),
                "updatedBy" character varying(50),
                "name" character varying NOT NULL,
                "description" character varying,
                "icon" character varying,
                CONSTRAINT "UQ_task_type_name" UNIQUE ("name"),
                CONSTRAINT "PK_task_type_id" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_task_type_name" ON "task_type" ("name")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "IDX_task_type_name"
        `);

    await queryRunner.query(`
            DROP TABLE "task_type"
        `);
  }
}
