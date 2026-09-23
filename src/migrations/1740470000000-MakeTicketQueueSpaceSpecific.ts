import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeTicketQueueSpaceSpecific1740470000000
  implements MigrationInterface
{
  name = 'MakeTicketQueueSpaceSpecific1740470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Making ticket queues space-specific...');

    // Check if ticket_queue table exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ticket_queue'
      )
    `);

    if (!tableExists[0].exists) {
      console.log('ticket_queue table does not exist. Skipping migration.');
      return;
    }

    // Step 1: Check if ticketSpaceId column already exists
    const hasTicketSpaceId = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'ticket_queue' 
        AND column_name = 'ticketSpaceId'
      )
    `);

    if (hasTicketSpaceId[0].exists) {
      console.log(
        'ticket_queue already has ticketSpaceId. Migration already applied.',
      );
      return;
    }

    // Step 2: Drop old unique constraint on name
    await queryRunner.query(`
      ALTER TABLE "ticket_queue" 
      DROP CONSTRAINT IF EXISTS "UQ_ticket_queue_name"
    `);
    console.log('Dropped old unique constraint on name');

    // Step 3: Add ticketSpaceId column (nullable first)
    await queryRunner.query(`
      ALTER TABLE "ticket_queue" 
      ADD COLUMN "ticketSpaceId" integer
    `);
    console.log('Added ticketSpaceId column');

    // Step 4: Populate ticketSpaceId from ticket_space_queue join table
    // For each queue, set its ticketSpaceId to the first space it's associated with
    await queryRunner.query(`
      UPDATE "ticket_queue" tq
      SET "ticketSpaceId" = (
        SELECT tsq."ticketSpaceId"
        FROM "ticket_space_queue" tsq
        WHERE tsq."ticketQueueId" = tq."id"
        ORDER BY tsq."ticketSpaceId"
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 
        FROM "ticket_space_queue" tsq 
        WHERE tsq."ticketQueueId" = tq."id"
      )
    `);
    console.log('Populated ticketSpaceId for existing queues');

    // Step 5: For queues shared across multiple spaces, duplicate them
    // This handles the case where a queue was associated with multiple spaces
    await queryRunner.query(`
      INSERT INTO "ticket_queue" ("ticketSpaceId", "name", "description", "createdAt", "updatedAt")
      SELECT 
        tsq."ticketSpaceId",
        tq."name",
        tq."description",
        now(),
        now()
      FROM "ticket_space_queue" tsq
      JOIN "ticket_queue" tq ON tq."id" = tsq."ticketQueueId"
      WHERE tsq."ticketSpaceId" != tq."ticketSpaceId"
      AND tq."ticketSpaceId" IS NOT NULL
    `);
    console.log('Duplicated queues that were shared across multiple spaces');

    // Step 6: Update the join table to point to the correct queue for each space
    await queryRunner.query(`
      UPDATE "ticket_space_queue" tsq
      SET "ticketQueueId" = (
        SELECT tq."id"
        FROM "ticket_queue" tq
        WHERE tq."ticketSpaceId" = tsq."ticketSpaceId"
        AND tq."name" = (
          SELECT tq2."name"
          FROM "ticket_queue" tq2
          WHERE tq2."id" = tsq."ticketQueueId"
        )
        ORDER BY tq."id"
        LIMIT 1
      )
    `);
    console.log('Updated join table references');

    // Step 7: Delete orphaned queues (those with null ticketSpaceId)
    await queryRunner.query(`
      DELETE FROM "ticket_queue"
      WHERE "ticketSpaceId" IS NULL
    `);
    console.log('Deleted orphaned queues');

    // Step 8: Make ticketSpaceId NOT NULL
    await queryRunner.query(`
      ALTER TABLE "ticket_queue" 
      ALTER COLUMN "ticketSpaceId" SET NOT NULL
    `);
    console.log('Made ticketSpaceId NOT NULL');

    // Step 9: Create new composite unique index (ticketSpaceId, name)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_ticket_queue_space_name_unique" 
      ON "ticket_queue" ("ticketSpaceId", "name")
    `);
    console.log('Created composite unique index on (ticketSpaceId, name)');

    // Step 10: Create index on ticketSpaceId for better performance
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_queue_ticketSpaceId" 
      ON "ticket_queue" ("ticketSpaceId")
    `);
    console.log('Created index on ticketSpaceId');

    console.log('Migration completed!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back space-specific ticket queues...');

    // Check if ticketSpaceId column exists
    const hasTicketSpaceId = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'ticket_queue' 
        AND column_name = 'ticketSpaceId'
      )
    `);

    if (!hasTicketSpaceId[0].exists) {
      console.log('ticketSpaceId column does not exist. Nothing to rollback.');
      return;
    }

    // Step 1: Drop composite unique index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ticket_queue_space_name_unique"
    `);

    // Step 2: Drop ticketSpaceId index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ticket_queue_ticketSpaceId"
    `);

    // Step 3: Drop ticketSpaceId column
    await queryRunner.query(`
      ALTER TABLE "ticket_queue" 
      DROP COLUMN IF EXISTS "ticketSpaceId"
    `);

    // Step 4: Recreate old unique constraint on name
    await queryRunner.query(`
      ALTER TABLE "ticket_queue" 
      ADD CONSTRAINT "UQ_ticket_queue_name" UNIQUE ("name")
    `);

    console.log('Rollback completed');
  }
}
