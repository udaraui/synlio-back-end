import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddTicketSlaIdToTicket1738818069000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add ticketSlaId column to ticket table
    await queryRunner.addColumn(
      'ticket',
      new TableColumn({
        name: 'ticketSlaId',
        type: 'integer',
        isNullable: true,
      }),
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'ticket',
      new TableForeignKey({
        columnNames: ['ticketSlaId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'ticket_sla',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key first
    const table = await queryRunner.getTable('ticket');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('ticketSlaId') !== -1,
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('ticket', foreignKey);
    }

    // Drop the column
    await queryRunner.dropColumn('ticket', 'ticketSlaId');
  }
}
