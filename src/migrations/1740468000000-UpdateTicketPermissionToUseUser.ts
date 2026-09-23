import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTicketPermissionToUseUser1740468000000
  implements MigrationInterface
{
  name = 'UpdateTicketPermissionToUseUser1740468000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ticket_permission'
      )
    `);

    if (!tableExists[0].exists) {
      // Create ticket_permission table if it doesn't exist
      await queryRunner.query(`
        CREATE TABLE "ticket_permission" (
          "id" SERIAL NOT NULL,
          "ticketSpaceId" integer NOT NULL,
          "userId" integer NOT NULL,
          "userFirstName" character varying,
          "userLastName" character varying,
          "userEmail" character varying,
          "roleId" integer NOT NULL,
          "roleName" character varying,
          "queueId" integer,
          "queueName" character varying,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "createdBy" character varying,
          "updatedBy" character varying,
          CONSTRAINT "PK_ticket_permission_id" PRIMARY KEY ("id")
        )
      `);

      // Add foreign key constraint for ticketSpaceId
      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        ADD CONSTRAINT "FK_ticket_permission_ticketSpace"
        FOREIGN KEY ("ticketSpaceId")
        REFERENCES "ticket_space"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
      `);

      // Add foreign key constraint for userId
      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        ADD CONSTRAINT "FK_ticket_permission_user"
        FOREIGN KEY ("userId")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
      `);

      // Add foreign key constraint for roleId
      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        ADD CONSTRAINT "FK_ticket_permission_role"
        FOREIGN KEY ("roleId")
        REFERENCES "role"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
      `);

      // Add foreign key constraint for queueId
      await queryRunner.query(`
        ALTER TABLE "ticket_permission"
        ADD CONSTRAINT "FK_ticket_permission_queue"
        FOREIGN KEY ("queueId")
        REFERENCES "ticket_queue"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION
      `);

      // Create index on ticketSpaceId
      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_ticketSpaceId"
        ON "ticket_permission" ("ticketSpaceId")
      `);

      // Create index on userId
      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_userId"
        ON "ticket_permission" ("userId")
      `);

      // Create index on roleId
      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_roleId"
        ON "ticket_permission" ("roleId")
      `);

      // Create index on queueId
      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_queueId"
        ON "ticket_permission" ("queueId")
      `);

      // Create unique constraint (allows multiple NULL queueIds for owners)
      // In PostgreSQL, NULL values are not considered equal in unique constraints
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_ticket_permission_unique"
        ON "ticket_permission" ("ticketSpaceId", "userId", "queueId")
        WHERE "queueId" IS NOT NULL
      `);

      console.log('ticket_permission table created');
    } else {
      // Table exists, check if we need to rename columns from resource to user
      const hasResourceId = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'ticket_permission' 
          AND column_name = 'resourceId'
        )
      `);

      if (hasResourceId[0].exists) {
        console.log('Migrating from resourceId to userId...');

        // Drop old foreign key constraint if exists
        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          DROP CONSTRAINT IF EXISTS "FK_ticket_permission_resource"
        `);

        // Drop old indexes if they exist
        await queryRunner.query(`
          DROP INDEX IF EXISTS "IDX_ticket_permission_resourceId"
        `);

        await queryRunner.query(`
          DROP INDEX IF EXISTS "IDX_ticket_permission_unique"
        `);

        // Rename columns
        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          RENAME COLUMN "resourceId" TO "userId"
        `);

        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          RENAME COLUMN "resourceFirstName" TO "userFirstName"
        `);

        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          RENAME COLUMN "resourceLastName" TO "userLastName"
        `);

        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          RENAME COLUMN "resourceEmail" TO "userEmail"
        `);

        // Add new foreign key constraint for userId
        await queryRunner.query(`
          ALTER TABLE "ticket_permission"
          ADD CONSTRAINT "FK_ticket_permission_user"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
        `);

        // Create index on userId
        await queryRunner.query(`
          CREATE INDEX "IDX_ticket_permission_userId"
          ON "ticket_permission" ("userId")
        `);

        // Recreate unique constraint (allows multiple NULL queueIds for owners)
        await queryRunner.query(`
          CREATE UNIQUE INDEX "IDX_ticket_permission_unique"
          ON "ticket_permission" ("ticketSpaceId", "userId", "queueId")
          WHERE "queueId" IS NOT NULL
        `);

        console.log('Columns renamed from resource to user');
      } else {
        console.log(
          'ticket_permission table already uses userId - no migration needed',
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ticket_permission'
      )
    `);

    if (tableExists[0].exists) {
      const hasUserId = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'ticket_permission' 
          AND column_name = 'userId'
        )
      `);

      if (hasUserId[0].exists) {
        console.log('Rolling back userId to resourceId...');

        // Drop constraints and indexes
        await queryRunner.query(`
          DROP INDEX IF EXISTS "IDX_ticket_permission_unique"
        `);

        await queryRunner.query(`
          DROP INDEX IF EXISTS "IDX_ticket_permission_userId"
        `);

        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          DROP CONSTRAINT IF EXISTS "FK_ticket_permission_user"
        `);

        // Rename columns back
        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          RENAME COLUMN "userId" TO "resourceId"
        `);

        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          RENAME COLUMN "userFirstName" TO "resourceFirstName"
        `);

        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          RENAME COLUMN "userLastName" TO "resourceLastName"
        `);

        await queryRunner.query(`
          ALTER TABLE "ticket_permission" 
          RENAME COLUMN "userEmail" TO "resourceEmail"
        `);

        // Add back resource foreign key
        await queryRunner.query(`
          ALTER TABLE "ticket_permission"
          ADD CONSTRAINT "FK_ticket_permission_resource"
          FOREIGN KEY ("resourceId")
          REFERENCES "resource"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
        `);

        // Recreate indexes
        await queryRunner.query(`
          CREATE INDEX "IDX_ticket_permission_resourceId"
          ON "ticket_permission" ("resourceId")
        `);

        await queryRunner.query(`
          CREATE UNIQUE INDEX "IDX_ticket_permission_unique"
          ON "ticket_permission" ("ticketSpaceId", "resourceId", "queueId")
        `);

        console.log('Rollback complete');
      }
    }
  }
}
