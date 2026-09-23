import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTestTable2179000000003 implements MigrationInterface {
    name = 'DropTestTable2179000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "test_migration_table_2"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "test_migration_table_2" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_test_migration_table_2" PRIMARY KEY ("id"))`);
    }
}
