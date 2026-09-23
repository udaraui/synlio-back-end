import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveGroupFromRole1784949923342 implements MigrationInterface {
    name = 'RemoveGroupFromRole1784949923342'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role" DROP COLUMN IF EXISTS "group" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "role" ADD COLUMN IF NOT EXISTS "group" character varying`);
    }
}
