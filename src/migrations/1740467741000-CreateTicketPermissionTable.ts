import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTicketPermissionTable1740467741000
  implements MigrationInterface
{
  name = 'CreateTicketPermissionTable1740467741000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ticket_permission table
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
        "queueId" integer NOT NULL,
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

    // Create index on ticketSpaceId for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_permission_ticketSpaceId"
      ON "ticket_permission" ("ticketSpaceId")
    `);

    // Create index on userId for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_permission_userId"
      ON "ticket_permission" ("userId")
    `);

    // Create index on roleId for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_permission_roleId"
      ON "ticket_permission" ("roleId")
    `);

    // Create index on queueId for better query performance
    await queryRunner.query(`
      CREATE INDEX "IDX_ticket_permission_queueId"
      ON "ticket_permission" ("queueId")
    `);

    // Create unique constraint to prevent duplicate permissions (same user + queue in same space)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_ticket_permission_unique"
      ON "ticket_permission" ("ticketSpaceId", "userId", "queueId")
    `);

    // Optional: Drop old ticket_space_member join table if it exists
    // Only uncomment if you want to remove the old table after data migration
    // await queryRunner.query(`DROP TABLE IF EXISTS "ticket_space_member" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_permission_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_permission_queueId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_permission_roleId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_permission_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_permission_ticketSpaceId"`,
    );

    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "ticket_permission" DROP CONSTRAINT IF EXISTS "FK_ticket_permission_queue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_permission" DROP CONSTRAINT IF EXISTS "FK_ticket_permission_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_permission" DROP CONSTRAINT IF EXISTS "FK_ticket_permission_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket_permission" DROP CONSTRAINT IF EXISTS "FK_ticket_permission_ticketSpace"`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_permission"`);

    // Optional: Recreate old ticket_space_member table if needed
    // await queryRunner.query(`
    //   CREATE TABLE "ticket_space_member" (
    //     "ticketSpaceId" integer NOT NULL,
    //     "userId" integer NOT NULL,
    //     CONSTRAINT "PK_ticket_space_member" PRIMARY KEY ("ticketSpaceId", "userId")
    //   )
    // `);
  }
}
