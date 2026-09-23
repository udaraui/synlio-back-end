import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePulseSnapshotStatusEnum1781600000006 implements MigrationInterface {
  name = 'UpdatePulseSnapshotStatusEnum1781600000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // We update the existing SUBMITTED value in the enum to FORWARDED.
    // PostgreSQL 10+ allows renaming enum values directly.
    await queryRunner.query(
      `ALTER TYPE "pulse_snapshot_status_enum" RENAME VALUE 'SUBMITTED' TO 'FORWARDED'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "pulse_snapshot_status_enum" RENAME VALUE 'FORWARDED' TO 'SUBMITTED'`
    );
  }
}
