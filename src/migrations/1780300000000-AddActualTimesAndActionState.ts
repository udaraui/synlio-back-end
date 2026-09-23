import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddActualTimesAndActionState1780300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. Add scheduled/actual time columns to meeting ─────────────────────
    await queryRunner.query(`
      ALTER TABLE meeting
        ADD COLUMN IF NOT EXISTS "scheduledStartTime" timestamp,
        ADD COLUMN IF NOT EXISTS "scheduledEndTime"   timestamp NULL,
        ADD COLUMN IF NOT EXISTS "actualStartTime"    timestamp NULL,
        ADD COLUMN IF NOT EXISTS "actualEndTime"      timestamp NULL;
    `);

    // Populate scheduledStartTime / scheduledEndTime from existing startTime / endTime
    await queryRunner.query(`
      UPDATE meeting
        SET "scheduledStartTime" = "startTime",
            "scheduledEndTime"   = "endTime"
        WHERE "scheduledStartTime" IS NULL;
    `);

    // Make scheduledStartTime NOT NULL (it now has data)
    await queryRunner.query(`
      ALTER TABLE meeting ALTER COLUMN "scheduledStartTime" SET NOT NULL;
    `);

    // ─── 2. Enum for meeting_action_state ────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE meeting_action_state_enum AS ENUM ('none', 'ignored', 'linked_to_task');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ─── 3. meeting_action_state table ───────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'meeting_action_state',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'meetingId', type: 'int', isNullable: false },
          { name: 'actedByUserId', type: 'int', isNullable: false },
          {
            name: 'state',
            type: 'meeting_action_state_enum',
            isNullable: false,
            default: `'none'`,
          },
          { name: 'taskId', type: 'int', isNullable: true },
          { name: 'note', type: 'text', isNullable: true },
          { name: 'actedAt', type: 'timestamp', default: 'now()' },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'createdBy', type: 'varchar', length: '50', isNullable: true },
          { name: 'updatedBy', type: 'varchar', length: '50', isNullable: true },
        ],
      }),
      true,
    );

    // Unique: one action state record per (meeting, user)
    await queryRunner.createIndex(
      'meeting_action_state',
      new TableIndex({
        name: 'IDX_mas_meetingId_userId',
        columnNames: ['meetingId', 'actedByUserId'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'meeting_action_state',
      new TableForeignKey({
        name: 'FK_mas_meetingId',
        columnNames: ['meetingId'],
        referencedTableName: 'meeting',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'meeting_action_state',
      new TableForeignKey({
        name: 'FK_mas_actedByUserId',
        columnNames: ['actedByUserId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('meeting_action_state', true);
    await queryRunner.query(`DROP TYPE IF EXISTS meeting_action_state_enum CASCADE`);
    await queryRunner.query(`
      ALTER TABLE meeting
        DROP COLUMN IF EXISTS "actualEndTime",
        DROP COLUMN IF EXISTS "actualStartTime",
        DROP COLUMN IF EXISTS "scheduledEndTime",
        DROP COLUMN IF EXISTS "scheduledStartTime";
    `);
  }
}
