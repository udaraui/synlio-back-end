import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateTaskDenormalizedColumnTypes1737553000000
  implements MigrationInterface
{
  private readonly tableName = 'tm_task';
  private readonly columns = [
    'taskSpaceName',
    'taskSpacePrefix',
    'statusName',
    'statusColor',
    'statusBase',
    'severityName',
    'severityColor',
    'assigneeName',
    'assigneeProfilePicUrl',
    'assigneeEmail',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const columnName of this.columns) {
      await queryRunner.changeColumn(
        this.tableName,
        columnName,
        new TableColumn({
          name: columnName,
          type: 'varchar',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const columnName of this.columns) {
      await queryRunner.changeColumn(
        this.tableName,
        columnName,
        new TableColumn({
          name: columnName,
          type: 'varchar',
          length: '512',
          isNullable: true,
        }),
      );
    }
  }
}
