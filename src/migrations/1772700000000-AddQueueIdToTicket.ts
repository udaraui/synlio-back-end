import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddQueueIdToTicket1772700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add queueId column to ticket table
    await queryRunner.addColumn(
      'ticket',
      new TableColumn({
        name: 'queueId',
        type: 'integer',
        isNullable: true,
      }),
    );

    // Add foreign key constraint for queueId
    await queryRunner.createForeignKey(
      'ticket',
      new TableForeignKey({
        name: 'FK_ticket_queue',
        columnNames: ['queueId'],
        referencedTableName: 'ticket_queue',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.dropForeignKey('ticket', 'FK_ticket_queue');

    // Drop queueId column
    await queryRunner.dropColumn('ticket', 'queueId');
  }
}
