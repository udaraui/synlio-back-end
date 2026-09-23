import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatePrivilegeEntity1775496373223 implements MigrationInterface {
    name = 'UpdatePrivilegeEntity1775496373223'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the enum type for level_type
        await queryRunner.query(`CREATE TYPE "public"."privilege_level_type_enum" AS ENUM('env', 'config', 'data')`);
        
        // Add the level_type column with a default value
        await queryRunner.query(`ALTER TABLE "privilege" ADD "level_type" "public"."privilege_level_type_enum" NOT NULL DEFAULT 'data'`);
        
        // Ensure the manual id column is unique (though it's already a primary key)
        await queryRunner.query(`ALTER TABLE "privilege" ADD CONSTRAINT "UQ_b1691196ff9c996998bab2e406e" UNIQUE ("id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback the unique constraint
        await queryRunner.query(`ALTER TABLE "privilege" DROP CONSTRAINT "UQ_b1691196ff9c996998bab2e406e"`);
        
        // Rollback the level_type column
        await queryRunner.query(`ALTER TABLE "privilege" DROP COLUMN "level_type"`);
        
        // Rollback the enum type
        await queryRunner.query(`DROP TYPE "public"."privilege_level_type_enum"`);
    }

}
