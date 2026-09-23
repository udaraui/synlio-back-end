import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTicketPermissionQueueJoinTable1740469000000
  implements MigrationInterface
{
  name = 'CreateTicketPermissionQueueJoinTable1740469000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if ticket_permission table exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ticket_permission'
      )
    `);

    if (!tableExists[0].exists) {
      console.log(
        'ticket_permission table does not exist. Please run previous migrations first.',
      );
      return;
    }

    // Check if old queueId column exists
    const hasQueueId = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'ticket_permission' 
        AND column_name = 'queueId'
      )
    `);

    if (hasQueueId[0].exists) {
      console.log('Migrating from single queue to multiple queues...');

      // Step 1: Create the join table for many-to-many relationship
      await queryRunner.query(`
        CREATE TABLE "ticket_permission_queue" (
          "permissionId" integer NOT NULL,
          "queueId" integer NOT NULL,
          CONSTRAINT "PK_ticket_permission_queue" PRIMARY KEY ("permissionId", "queueId")
        )
      `);

      // Step 2: Add foreign key constraints
      await queryRunner.query(`
        ALTER TABLE "ticket_permission_queue"
        ADD CONSTRAINT "FK_ticket_permission_queue_permission"
        FOREIGN KEY ("permissionId")
        REFERENCES "ticket_permission"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);

      await queryRunner.query(`
        ALTER TABLE "ticket_permission_queue"
        ADD CONSTRAINT "FK_ticket_permission_queue_queue"
        FOREIGN KEY ("queueId")
        REFERENCES "ticket_queue"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);

      // Step 3: Create indexes on join table
      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_queue_permissionId"
        ON "ticket_permission_queue" ("permissionId")
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_queue_queueId"
        ON "ticket_permission_queue" ("queueId")
      `);

      // Step 4: Migrate existing data - copy queueId to join table
      await queryRunner.query(`
        INSERT INTO "ticket_permission_queue" ("permissionId", "queueId")
        SELECT "id", "queueId"
        FROM "ticket_permission"
        WHERE "queueId" IS NOT NULL
      `);

      // Step 5: Drop old unique constraint if exists
      await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_ticket_permission_unique"
      `);

      // Step 6: Drop old queueId index if exists
      await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_ticket_permission_queueId"
      `);

      // Step 7: Drop old foreign key constraint if exists
      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        DROP CONSTRAINT IF EXISTS "FK_ticket_permission_queue"
      `);

      // Step 8: Drop old queueId and queueName columns
      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        DROP COLUMN IF EXISTS "queueId"
      `);

      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        DROP COLUMN IF EXISTS "queueName"
      `);

      // Step 9: Create new unique constraint (user can only have one permission per ticket space)
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_ticket_permission_unique_user"
        ON "ticket_permission" ("ticketSpaceId", "userId")
      `);

      console.log('Migration to multiple queues completed!');
    } else {
      console.log(
        'ticket_permission already uses multiple queues - no migration needed',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back multiple queues migration...');

    // Check if join table exists
    const joinTableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ticket_permission_queue'
      )
    `);

    if (joinTableExists[0].exists) {
      // Step 1: Drop unique constraint
      await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_ticket_permission_unique_user"
      `);

      // Step 2: Add back queueId and queueName columns
      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        ADD COLUMN "queueId" integer
      `);

      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        ADD COLUMN "queueName" character varying
      `);

      // Step 3: Migrate data back - take first queue from join table
      await queryRunner.query(`
        UPDATE "ticket_permission" tp
        SET "queueId" = tpq."queueId",
            "queueName" = tq."name"
        FROM (
          SELECT DISTINCT ON ("permissionId") "permissionId", "queueId"
          FROM "ticket_permission_queue"
          ORDER BY "permissionId", "queueId"
        ) tpq
        JOIN "ticket_queue" tq ON tq."id" = tpq."queueId"
        WHERE tp."id" = tpq."permissionId"
      `);

      // Step 4: Add back foreign key
      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        ADD CONSTRAINT "FK_ticket_permission_queue"
        FOREIGN KEY ("queueId")
        REFERENCES "ticket_queue"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
      `);

      // Step 5: Add back index
      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_queueId"
        ON "ticket_permission" ("queueId")
      `);

      // Step 6: Recreate old unique constraint
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_ticket_permission_unique"
        ON "ticket_permission" ("ticketSpaceId", "userId", "queueId")
        WHERE "queueId" IS NOT NULL
      `);

      // Step 7: Drop join table
      await queryRunner.query(`
        DROP TABLE IF EXISTS "ticket_permission_queue" CASCADE
      `);

      console.log('Rollback completed');
    }
  }
}
