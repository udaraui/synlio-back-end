import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParentTaskIdToPostSequence1782096501938 implements MigrationInterface {
    name = 'AddParentTaskIdToPostSequence1782096501938'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the old index and constraint
        await queryRunner.query(`ALTER TABLE "post_sequence" DROP CONSTRAINT "UQ_4eb23927429188d8b6711718870"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_companyId_spaceId_postType_levelPrefix"`);
        
        // Add the new column
        await queryRunner.query(`ALTER TABLE "post_sequence" ADD "parentTaskId" integer`);
        
        // Create the new index and constraint
        await queryRunner.query(`CREATE INDEX "IDX_companyId_spaceId_postType_levelPrefix_parentTaskId" ON "post_sequence" ("companyId", "spaceId", "postType", "levelPrefix", "parentTaskId") `);
        await queryRunner.query(`ALTER TABLE "post_sequence" ADD CONSTRAINT "UQ_00787e82674298e9b8082eef136" UNIQUE ("companyId", "spaceId", "postType", "levelPrefix", "parentTaskId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the new index and constraint
        await queryRunner.query(`ALTER TABLE "post_sequence" DROP CONSTRAINT "UQ_00787e82674298e9b8082eef136"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_companyId_spaceId_postType_levelPrefix_parentTaskId"`);
        
        // Drop the new column
        await queryRunner.query(`ALTER TABLE "post_sequence" DROP COLUMN "parentTaskId"`);
        
        // Re-create the old index and constraint
        await queryRunner.query(`ALTER TABLE "post_sequence" ADD CONSTRAINT "UQ_4eb23927429188d8b6711718870" UNIQUE ("companyId", "spaceId", "postType", "levelPrefix")`);
        await queryRunner.query(`CREATE INDEX "IDX_companyId_spaceId_postType_levelPrefix" ON "post_sequence" ("companyId", "spaceId", "postType", "levelPrefix") `);
    }
}
