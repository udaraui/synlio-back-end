import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWorkLogPostTypeEnum1778600000004 implements MigrationInterface {
    name = 'UpdateWorkLogPostTypeEnum1778600000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "work_log" ALTER COLUMN "postType" TYPE post_type_enum USING "postType"::text::post_type_enum`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "work_log" ALTER COLUMN "postType" TYPE work_log_posttype_enum USING "postType"::text::work_log_posttype_enum`);
    }

}