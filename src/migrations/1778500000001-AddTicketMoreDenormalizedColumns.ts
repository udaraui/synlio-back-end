import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTicketMoreDenormalizedColumns1778500000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('ticket', [
      new TableColumn({
        name: 'ticketTypeIcon',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'slaResponseTime',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'slaResolutionTime',
        type: 'int',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('ticket', [
      'ticketTypeIcon',
      'slaResponseTime',
      'slaResolutionTime',
    ]);
  }
}
