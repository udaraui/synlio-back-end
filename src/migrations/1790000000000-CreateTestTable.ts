import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTestTable1790000000000 implements MigrationInterface {
    name = 'CreateTestTable1790000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "test_migration_table" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_test_migration_table" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "test_migration_table"`);
    }
}
