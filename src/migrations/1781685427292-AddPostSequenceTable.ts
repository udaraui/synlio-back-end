import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPostSequenceTable1781685427292 implements MigrationInterface {
    name = 'AddPostSequenceTable1781685427292'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "post_sequence" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" character varying(250) NOT NULL, "updatedBy" character varying(250), "isActive" boolean NOT NULL DEFAULT true, "companyId" integer NOT NULL, "spaceId" integer NOT NULL, "postType" "public"."post_type_enum" NOT NULL, "levelPrefix" character varying, "levelSequence" integer, "nextNumber" integer NOT NULL DEFAULT 1, CONSTRAINT "UQ_4eb23927429188d8b6711718870" UNIQUE ("companyId", "spaceId", "postType", "levelPrefix"), CONSTRAINT "PK_post_sequence_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "post_sequence"`);
    }
}
