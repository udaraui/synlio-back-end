import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateTicketSpaceQueueJoinTable1771400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ticket_space_queue join table
    await queryRunner.createTable(
      new Table({
        name: 'ticket_space_queue',
        columns: [
          {
            name: 'ticketSpaceId',
            type: 'int',
            isPrimary: true,
          },
          {
            name: 'ticketQueueId',
            type: 'int',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    // Add foreign key to ticket_space
    await queryRunner.createForeignKey(
      'ticket_space_queue',
      new TableForeignKey({
        columnNames: ['ticketSpaceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'ticket_space',
        onDelete: 'CASCADE',
      }),
    );

    // Add foreign key to ticket_queue
    await queryRunner.createForeignKey(
      'ticket_space_queue',
      new TableForeignKey({
        columnNames: ['ticketQueueId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'ticket_queue',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the join table (foreign keys will be dropped automatically with CASCADE)
    await queryRunner.dropTable('ticket_space_queue', true);
  }
}
