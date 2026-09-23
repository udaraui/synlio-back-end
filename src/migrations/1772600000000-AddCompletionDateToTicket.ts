import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCompletionDateToTicket1772600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add completionDate column to ticket table
    await queryRunner.addColumn(
      'ticket',
      new TableColumn({
        name: 'completionDate',
        type: 'date',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove completionDate column from ticket table
    await queryRunner.dropColumn('ticket', 'completionDate');
  }
}
