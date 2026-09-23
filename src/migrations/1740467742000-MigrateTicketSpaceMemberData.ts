import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateTicketSpaceMemberData1740467742000
  implements MigrationInterface
{
  name = 'MigrateTicketSpaceMemberData1740467742000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if old ticket_space_member table exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ticket_space_member'
      )
    `);

    if (tableExists[0].exists) {
      console.log(
        'Migrating data from ticket_space_member to ticket_permission...',
      );

      // Migrate existing members to permissions
      // This maps userId from ticket_space_member directly to userId in ticket_permission
      await queryRunner.query(`
        INSERT INTO "ticket_permission" (
          "ticketSpaceId",
          "userId",
          "userFirstName",
          "userLastName",
          "userEmail",
          "roleId",
          "roleName",
          "queueId",
          "queueName",
          "createdAt",
          "updatedAt",
          "createdBy",
          "updatedBy"
        )
        SELECT 
          tsm."ticketSpaceId",
          u."id" as "userId",
          u."firstName" as "userFirstName",
          u."lastName" as "userLastName",
          u."email" as "userEmail",
          (
            SELECT role."id" 
            FROM "role" 
            WHERE role."role" = 'Member' 
            AND role."group" = 'Ticket Management'
            LIMIT 1
          ) as "roleId",
          'Member' as "roleName",
          (
            SELECT tsq."ticketQueueId"
            FROM "ticket_space_queue" tsq
            WHERE tsq."ticketSpaceId" = tsm."ticketSpaceId"
            ORDER BY tsq."ticketQueueId"
            LIMIT 1
          ) as "queueId",
          (
            SELECT tq."name"
            FROM "ticket_space_queue" tsq
            JOIN "ticket_queue" tq ON tq."id" = tsq."ticketQueueId"
            WHERE tsq."ticketSpaceId" = tsm."ticketSpaceId"
            ORDER BY tsq."ticketQueueId"
            LIMIT 1
          ) as "queueName",
          now() as "createdAt",
          now() as "updatedAt",
          'system_migration' as "createdBy",
          'system_migration' as "updatedBy"
        FROM "ticket_space_member" tsm
        JOIN "user" u ON u."id" = tsm."userId"
        WHERE NOT EXISTS (
          SELECT 1 
          FROM "ticket_permission" tp 
          WHERE tp."ticketSpaceId" = tsm."ticketSpaceId" 
          AND tp."userId" = u."id"
        )
        ON CONFLICT DO NOTHING
      `);

      console.log('Data migration completed!');

      // Optional: You can uncomment this to drop the old table after migration
      // console.log('Dropping old ticket_space_member table...');
      // await queryRunner.query(`DROP TABLE IF EXISTS "ticket_space_member" CASCADE`);
      // console.log('Old table dropped.');
    } else {
      console.log(
        'ticket_space_member table does not exist. Skipping data migration.',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back data migration...');

    // Delete all permissions that were created by the migration
    await queryRunner.query(`
      DELETE FROM "ticket_permission" 
      WHERE "createdBy" = 'system_migration'
    `);

    console.log('Rollback completed.');

    // Note: This does not recreate the old ticket_space_member table
    // or restore the old data. You would need to restore from a backup.
  }
}
