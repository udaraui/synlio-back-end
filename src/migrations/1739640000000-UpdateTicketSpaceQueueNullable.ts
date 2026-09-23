import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTicketSpaceQueueNullable1739640000000
  implements MigrationInterface
{
  name = 'UpdateTicketSpaceQueueNullable1739640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make ticketQueueId nullable
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ALTER COLUMN "ticketQueueId" DROP NOT NULL
    `);

    // Make ticketQueueName nullable
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ALTER COLUMN "ticketQueueName" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert ticketQueueName to NOT NULL
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ALTER COLUMN "ticketQueueName" SET NOT NULL
    `);

    // Revert ticketQueueId to NOT NULL
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ALTER COLUMN "ticketQueueId" SET NOT NULL
    `);
  }
}
