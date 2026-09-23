import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostSequenceIndex1781926389816 implements MigrationInterface {
    name = 'AddPostSequenceIndex1781926389816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_companyId_spaceId_postType_levelPrefix" ON "post_sequence" ("companyId", "spaceId", "postType", "levelPrefix")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_companyId_spaceId_postType_levelPrefix"`);
    }
}
