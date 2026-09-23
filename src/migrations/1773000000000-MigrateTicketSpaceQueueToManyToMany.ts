import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateTicketSpaceQueueToManyToMany1773000000000
  implements MigrationInterface
{
  name = 'MigrateTicketSpaceQueueToManyToMany1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Migrate existing single queue relationships to the join table
    await queryRunner.query(`
      INSERT INTO ticket_space_queue ("ticketSpaceId", "ticketQueueId")
      SELECT id, "ticketQueueId"
      FROM ticket_space
      WHERE "ticketQueueId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ticket_space_queue tsq 
        WHERE tsq."ticketSpaceId" = ticket_space.id 
        AND tsq."ticketQueueId" = ticket_space."ticketQueueId"
      )
    `);

    // Drop the old ticketQueueId column
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      DROP COLUMN IF EXISTS "ticketQueueId"
    `);

    // Drop the old ticketQueueName column
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      DROP COLUMN IF EXISTS "ticketQueueName"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the ticketQueueId column
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ADD COLUMN "ticketQueueId" integer
    `);

    // Re-add the ticketQueueName column
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ADD COLUMN "ticketQueueName" varchar
    `);

    // Migrate data back from join table (take first queue if multiple exist)
    await queryRunner.query(`
      UPDATE ticket_space ts
      SET "ticketQueueId" = subquery."ticketQueueId"
      FROM (
        SELECT DISTINCT ON ("ticketSpaceId") 
          "ticketSpaceId", 
          "ticketQueueId"
        FROM ticket_space_queue
        ORDER BY "ticketSpaceId", "ticketQueueId"
      ) subquery
      WHERE ts.id = subquery."ticketSpaceId"
    `);

    // Update ticketQueueName from ticket_queue table
    await queryRunner.query(`
      UPDATE ticket_space ts
      SET "ticketQueueName" = tq.name
      FROM ticket_queue tq
      WHERE ts."ticketQueueId" = tq.id
      AND ts."ticketQueueId" IS NOT NULL
    `);

    // Add foreign key constraint back
    await queryRunner.query(`
      ALTER TABLE "ticket_space"
      ADD CONSTRAINT "FK_ticket_space_ticketQueue"
      FOREIGN KEY ("ticketQueueId")
      REFERENCES "ticket_queue"("id")
      ON DELETE SET NULL
    `);
  }
}
