import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTestTable3179000000004 implements MigrationInterface {
    name = 'CreateTestTable3179000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "test_migration_table_3" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_test_migration_table_3" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "test_migration_table_3"`);
    }
}
