import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTaskLogTable1778600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tm_task_log',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'companyId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'divisionId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'taskId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'taskCode',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'taskEventId',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'resourceType',
            type: 'enum',
            enum: ['USER', 'TEAM', 'ROLE'], // Assuming from AssigneeTypeEnum
            isNullable: false,
          },
          {
            name: 'resourceId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'resourceName',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'resourceEmail',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'startTimeDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'endTimeDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'effort',
            type: 'int',
            default: 0,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'int',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'tm_task_log',
      new TableIndex({
        name: 'IDX_task_log_company_task_resource',
        columnNames: ['companyId', 'taskId', 'resourceId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tm_task_log');
  }
}
