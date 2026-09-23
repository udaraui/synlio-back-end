import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateNewActivityTable1782900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'new_activity',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'ownerUserId', type: 'int', isNullable: false },
          { name: 'companyId', type: 'int', isNullable: false },
          { name: 'title', type: 'varchar', length: '500', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'startDate', type: 'timestamp', isNullable: false },
          { name: 'endDate', type: 'timestamp', isNullable: true },
          { name: 'durationMinutes', type: 'int', isNullable: true },
          { name: 'taskId', type: 'int', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'createdBy', type: 'varchar', length: '50', isNullable: true },
          { name: 'updatedBy', type: 'varchar', length: '50', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'new_activity',
      new TableIndex({
        name: 'IDX_new_activity_ownerUserId_companyId',
        columnNames: ['ownerUserId', 'companyId'],
      }),
    );

    await queryRunner.createIndex(
      'new_activity',
      new TableIndex({
        name: 'IDX_new_activity_ownerUserId_startDate',
        columnNames: ['ownerUserId', 'startDate'],
      }),
    );

    await queryRunner.createForeignKey(
      'new_activity',
      new TableForeignKey({
        name: 'FK_new_activity_ownerUserId',
        columnNames: ['ownerUserId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('new_activity', 'FK_new_activity_ownerUserId');
    await queryRunner.dropIndex('new_activity', 'IDX_new_activity_ownerUserId_startDate');
    await queryRunner.dropIndex('new_activity', 'IDX_new_activity_ownerUserId_companyId');
    await queryRunner.dropTable('new_activity', true);
  }
}
