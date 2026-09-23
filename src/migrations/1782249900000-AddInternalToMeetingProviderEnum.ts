import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInternalToMeetingProviderEnum1782249900000 implements MigrationInterface {
    name = 'AddInternalToMeetingProviderEnum1782249900000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Postgres syntax to add an enum value
        await queryRunner.query(`ALTER TYPE "public"."meeting_provider_enum" ADD VALUE IF NOT EXISTS 'internal'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Postgres does not support dropping enum values easily, so we usually leave it or recreate the type
    }
}
