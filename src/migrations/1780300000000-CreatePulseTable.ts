import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePulseTable1780300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pulse_type_enum') THEN
              CREATE TYPE "pulse_type_enum" AS ENUM ('INDIVIDUAL', 'PROJECT');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type_enum') THEN
              CREATE TYPE "post_type_enum" AS ENUM ('TASK', 'TICKET', 'PROJECT');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignee_type_enum') THEN
              CREATE TYPE "assignee_type_enum" AS ENUM ('ASSIGNEE', 'SUB_ASSIGNEE');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pulse_snapshot_status_enum') THEN
              CREATE TYPE "pulse_snapshot_status_enum" AS ENUM ('PENDING', 'SUBMITTED');
          END IF;
      END$$;

      CREATE TABLE "pulse" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "companyId" integer NOT NULL,
        "pulseType" "pulse_type_enum" NOT NULL,
        "postType" "post_type_enum",
        "postId" integer,
        "postCode" character varying(100),
        "postName" character varying,
        "postSpaceId" integer,
        "postSpaceName" character varying,
        "resourceType" "assignee_type_enum" NOT NULL,
        "pulseSummary" character varying,
        "attentionConditions" character varying,
        "meetingType" character varying,
        "allocatedHours" numeric,
        "pulseSnapshotStatus" "pulse_snapshot_status_enum" NOT NULL,
        "submittedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_pulse_id" PRIMARY KEY ("id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "pulse";
      DROP TYPE "pulse_type_enum";
      DROP TYPE "post_type_enum";
      DROP TYPE "assignee_type_enum";
      DROP TYPE "pulse_snapshot_status_enum";
    `);
  }
}