import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeTicketImpactSpaceSpecific1740471000000
  implements MigrationInterface
{
  name = 'MakeTicketImpactSpaceSpecific1740471000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Making ticket impacts space-specific...');

    // Check if ticket_impact table exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ticket_impact'
      )
    `);

    if (!tableExists[0].exists) {
      console.log('ticket_impact table does not exist. Skipping migration.');
      return;
    }

    // Step 1: Check if ticketSpaceId column already exists
    const hasTicketSpaceId = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'ticket_impact' 
        AND column_name = 'ticketSpaceId'
      )
    `);

    if (hasTicketSpaceId[0].exists) {
      console.log(
        'ticket_impact already has ticketSpaceId. Migration already applied.',
      );
      return;
    }

    // Step 2: Drop old unique constraint on name
    await queryRunner.query(`
      ALTER TABLE "ticket_impact" 
      DROP CONSTRAINT IF EXISTS "UQ_ticket_impact_name"
    `);
    console.log('Dropped old unique constraint on name');

    // Step 3: Add ticketSpaceId column (nullable first)
    await queryRunner.query(`
      ALTER TABLE "ticket_impact" 
      ADD COLUMN "ticketSpaceId" integer
    `);
    console.log('Added ticketSpaceId column');

    // Step 4: Populate ticketSpaceId from ticket_space_impact join table
    await queryRunner.query(`
      UPDATE "ticket_impact" ti
      SET "ticketSpaceId" = (
        SELECT tsi."ticketSpaceId"
        FROM "ticket_space_impact" tsi
        WHERE tsi."ticketImpactId" = ti."id"
        ORDER BY tsi."ticketSpaceId"
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 
        FROM "ticket_space_impact" tsi 
        WHERE tsi."ticketImpactId" = ti."id"
      )
    `);
    console.log('Populated ticketSpaceId for existing impacts');

    // Step 5: For impacts shared across multiple spaces, duplicate them
    await queryRunner.query(`
      INSERT INTO "ticket_impact" ("ticketSpaceId", "name", "description", "createdAt", "updatedAt")
      SELECT 
        tsi."ticketSpaceId",
        ti."name",
        ti."description",
        now(),
        now()
      FROM "ticket_space_impact" tsi
      JOIN "ticket_impact" ti ON ti."id" = tsi."ticketImpactId"
      WHERE tsi."ticketSpaceId" != ti."ticketSpaceId"
      AND ti."ticketSpaceId" IS NOT NULL
    `);
    console.log('Duplicated impacts that were shared across multiple spaces');

    // Step 6: Update the join table to point to the correct impact for each space
    await queryRunner.query(`
      UPDATE "ticket_space_impact" tsi
      SET "ticketImpactId" = (
        SELECT ti."id"
        FROM "ticket_impact" ti
        WHERE ti."ticketSpaceId" = tsi."ticketSpaceId"
        AND ti."name" = (
          SELECT ti2."name"
          FROM "ticket_impact" ti2
          WHERE ti2."id" = tsi."ticketImpactId"
        )
        ORDER BY ti."id"
        LIMIT 1
      )
    `);
    console.log('Updated join table references');

    // Step 7: Delete orphaned impacts (those with null ticketSpaceId)
    await queryRunner.query(`
      DELETE FROM "ticket_impact"
      WHERE "ticketSpaceId" IS NULL
    `);
    console.log('Deleted orphaned impacts');

    // Step 8: Make ticketSpaceId NOT NULL
    await queryRunner.query(`
      ALTER TABLE "ticket_impact" 
      ALTER COLUMN "ticketSpaceId" SET NOT NULL
    `);
    console.log('Made ticketSpaceId NOT NULL');

    // Step 9: Create new composite unique index (ticketSpaceId, name)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_ticket_impact_space_name_unique" 
      ON "ticket_impact" ("ticketSpaceId", "name")
    `);
    console.log('Created composite unique index on (ticketSpaceId, name)');

    // Step 10: Create index on ticketSpaceId for better performance
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_impact_ticketSpaceId" 
      ON "ticket_impact" ("ticketSpaceId")
    `);
    console.log('Created index on ticketSpaceId');

    console.log('Migration completed!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back space-specific ticket impacts...');

    // Check if ticketSpaceId column exists
    const hasTicketSpaceId = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'ticket_impact' 
        AND column_name = 'ticketSpaceId'
      )
    `);

    if (!hasTicketSpaceId[0].exists) {
      console.log('ticketSpaceId column does not exist. Nothing to rollback.');
      return;
    }

    // Step 1: Drop composite unique index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ticket_impact_space_name_unique"
    `);

    // Step 2: Drop ticketSpaceId index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ticket_impact_ticketSpaceId"
    `);

    // Step 3: Drop ticketSpaceId column
    await queryRunner.query(`
      ALTER TABLE "ticket_impact" 
      DROP COLUMN IF EXISTS "ticketSpaceId"
    `);

    // Step 4: Recreate old unique constraint on name
    await queryRunner.query(`
      ALTER TABLE "ticket_impact" 
      ADD CONSTRAINT "UQ_ticket_impact_name" UNIQUE ("name")
    `);

    console.log('Rollback completed');
  }
}
