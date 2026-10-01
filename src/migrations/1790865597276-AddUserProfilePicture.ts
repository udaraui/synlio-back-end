import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserProfilePicture1790865597276 implements MigrationInterface {
    name = 'AddUserProfilePicture1790865597276'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_temporary" ADD "profile_picture" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_temporary" DROP COLUMN "profile_picture"`);
    }
}
