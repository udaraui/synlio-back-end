import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTestTable1790000000001 implements MigrationInterface {
    name = 'DropTestTable1790000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "test_migration_table"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "test_migration_table" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_test_migration_table" PRIMARY KEY ("id"))`);
    }
}
