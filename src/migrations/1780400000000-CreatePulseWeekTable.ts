import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePulseWeekTable1780400000000 implements MigrationInterface {
    name = 'CreatePulseWeekTable1780400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "pulse_week" (
                "id" SERIAL NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                "createdBy" integer,
                "updatedBy" integer,
                "companyId" integer NOT NULL,
                "weekStartDate" date NOT NULL,
                "weekEndDate" date NOT NULL,
                "status" "public"."pulse_snapshot_status_enum" NOT NULL DEFAULT 'PENDING',
                "submittedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_a8b3b3c6e2f6d6e6d6e6d6e6d6e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "pulse"
            ADD "pulseWeekId" integer
        `);
        await queryRunner.query(`
            ALTER TABLE "pulse"
            ADD CONSTRAINT "FK_b9c6d6e6d6e6d6e6d6e6d6e6d6e" FOREIGN KEY ("pulseWeekId") REFERENCES "pulse_week"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "pulse" DROP COLUMN "pulseSnapshotStatus"
        `);
        await queryRunner.query(`
            ALTER TABLE "pulse" DROP COLUMN "submittedAt"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "pulse"
            ADD "submittedAt" TIMESTAMP WITH TIME ZONE
        `);
        await queryRunner.query(`
            ALTER TABLE "pulse"
            ADD "pulseSnapshotStatus" "public"."pulse_snapshot_status_enum" NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "pulse" DROP CONSTRAINT "FK_b9c6d6e6d6e6d6e6d6e6d6e6d6e"
        `);
        await queryRunner.query(`
            ALTER TABLE "pulse" DROP COLUMN "pulseWeekId"
        `);
        await queryRunner.query(`
            DROP TABLE "pulse_week"
        `);
    }

}