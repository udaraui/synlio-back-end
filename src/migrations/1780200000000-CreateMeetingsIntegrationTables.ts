import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateMeetingsIntegrationTables1780200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. Enums ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE meeting_provider_enum AS ENUM ('teams', 'zoom', 'google_meet', 'slack');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE connection_status_enum AS ENUM ('connected', 'error', 'revoked');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE meeting_status_enum AS ENUM ('scheduled', 'ongoing', 'ended', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE sync_status_enum AS ENUM ('ok', 'error');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ─── 2. meeting_integration_connection ────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'meeting_integration_connection',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'userId', type: 'int', isNullable: false },
          {
            name: 'provider',
            type: 'meeting_provider_enum',
            isNullable: false,
          },
          { name: 'accessToken', type: 'text', isNullable: false },
          { name: 'refreshToken', type: 'text', isNullable: true },
          { name: 'expiresAt', type: 'timestamp', isNullable: true },
          { name: 'scopes', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'providerUserId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tenantId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'connection_status_enum',
            isNullable: false,
            default: `'connected'`,
          },
          {
            name: 'lastConnectedAt',
            type: 'timestamp',
            isNullable: true,
          },
          { name: 'lastSyncAt', type: 'timestamp', isNullable: true },
          { name: 'lastError', type: 'text', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'createdBy',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'meeting_integration_connection',
      new TableIndex({
        name: 'IDX_mic_userId_provider',
        columnNames: ['userId', 'provider'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'meeting_integration_connection',
      new TableForeignKey({
        name: 'FK_mic_userId',
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ─── 3. meeting ───────────────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'meeting',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'provider',
            type: 'meeting_provider_enum',
            isNullable: false,
          },
          {
            name: 'externalId',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          { name: 'ownerUserId', type: 'int', isNullable: false },
          {
            name: 'title',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          { name: 'startTime', type: 'timestamp', isNullable: false },
          { name: 'endTime', type: 'timestamp', isNullable: true },
          { name: 'durationMinutes', type: 'int', isNullable: true },
          {
            name: 'joinUrl',
            type: 'varchar',
            length: '1000',
            isNullable: true,
          },
          {
            name: 'organizerEmail',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'meeting_status_enum',
            isNullable: false,
            default: `'scheduled'`,
          },
          { name: 'providerMetadata', type: 'jsonb', isNullable: true },
          { name: 'syncedAt', type: 'timestamp', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          {
            name: 'createdBy',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'meeting',
      new TableIndex({
        name: 'IDX_meeting_provider_externalId_owner',
        columnNames: ['provider', 'externalId', 'ownerUserId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'meeting',
      new TableIndex({
        name: 'IDX_meeting_ownerUserId_startTime',
        columnNames: ['ownerUserId', 'startTime'],
      }),
    );

    await queryRunner.createForeignKey(
      'meeting',
      new TableForeignKey({
        name: 'FK_meeting_ownerUserId',
        columnNames: ['ownerUserId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ─── 4. meeting_attendee ──────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'meeting_attendee',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'meetingId', type: 'int', isNullable: false },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'responseStatus',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          { name: 'joined', type: 'boolean', isNullable: true, default: null },
          { name: 'providerMetadata', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          {
            name: 'createdBy',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'meeting_attendee',
      new TableForeignKey({
        name: 'FK_meeting_attendee_meetingId',
        columnNames: ['meetingId'],
        referencedTableName: 'meeting',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ─── 5. meeting_sync_state ────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'meeting_sync_state',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'userId', type: 'int', isNullable: false },
          {
            name: 'provider',
            type: 'meeting_provider_enum',
            isNullable: false,
          },
          { name: 'lastSyncAt', type: 'timestamp', isNullable: true },
          { name: 'deltaToken', type: 'text', isNullable: true },
          {
            name: 'lastStatus',
            type: 'sync_status_enum',
            isNullable: false,
            default: `'ok'`,
          },
          { name: 'lastError', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          {
            name: 'createdBy',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'meeting_sync_state',
      new TableIndex({
        name: 'IDX_mss_userId_provider',
        columnNames: ['userId', 'provider'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('meeting_sync_state', true);
    await queryRunner.dropTable('meeting_attendee', true);
    await queryRunner.dropTable('meeting', true);
    await queryRunner.dropTable('meeting_integration_connection', true);

    await queryRunner.query(
      `DROP TYPE IF EXISTS sync_status_enum CASCADE`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS meeting_status_enum CASCADE`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS connection_status_enum CASCADE`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS meeting_provider_enum CASCADE`,
    );
  }
}
