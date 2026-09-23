import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTestTable2179000000002 implements MigrationInterface {
    name = 'CreateTestTable2179000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "test_migration_table_2" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_test_migration_table_2" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "test_migration_table_2"`);
    }
}
