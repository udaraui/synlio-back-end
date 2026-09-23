import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDraftToPulseSnapshotStatus1782250000000 implements MigrationInterface {
  name = 'AddDraftToPulseSnapshotStatus1782250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add DRAFT status to the enum
    await queryRunner.query(`ALTER TYPE "pulse_snapshot_status_enum" ADD VALUE IF NOT EXISTS 'DRAFT'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values directly using ALTER TYPE.
    // Reverting this would require recreating the enum type, which we omit here for safety.
  }
}
