import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTicketMoreDenormalizedColumns1778500000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('ticket', [
      new TableColumn({
        name: 'ticketSpacePrefix',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'statusName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'statusColor',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'statusBase',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'severityName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'severityColor',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'ticketTypeName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'departmentName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'queueName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'impactName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'assigneeName',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'assigneeProfilePicUrl',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'assigneeEmail',
        type: 'varchar',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('ticket', [
      'ticketSpaceName',
      'ticketSpacePrefix',
      'statusName',
      'statusColor',
      'statusBase',
      'severityName',
      'severityColor',
      'ticketTypeName',
      'departmentName',
      'queueName',
      'impactName',
      'assigneeName',
      'assigneeProfilePicUrl',
      'assigneeEmail',
    ]);
  }
}
