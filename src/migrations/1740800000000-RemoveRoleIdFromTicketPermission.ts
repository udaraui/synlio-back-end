import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRoleIdFromTicketPermission1740800000000
  implements MigrationInterface
{
  name = 'RemoveRoleIdFromTicketPermission1740800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if ticket_permission_role table exists, if not create it
    const tableExists = await queryRunner.hasTable('ticket_permission_role');

    if (!tableExists) {
      // Create join table for permission-role many-to-many relationship
      await queryRunner.query(`
        CREATE TABLE "ticket_permission_role" (
          "permissionId" integer NOT NULL,
          "roleId" integer NOT NULL,
          CONSTRAINT "PK_ticket_permission_role" PRIMARY KEY ("permissionId", "roleId")
        )
      `);

      // Add indexes
      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_role_permissionId" 
        ON "ticket_permission_role" ("permissionId")
      `);

      await queryRunner.query(`
        CREATE INDEX "IDX_ticket_permission_role_roleId" 
        ON "ticket_permission_role" ("roleId")
      `);

      // Add foreign key constraints
      await queryRunner.query(`
        ALTER TABLE "ticket_permission_role"
        ADD CONSTRAINT "FK_ticket_permission_role_permission"
        FOREIGN KEY ("permissionId")
        REFERENCES "ticket_permission"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);

      await queryRunner.query(`
        ALTER TABLE "ticket_permission_role"
        ADD CONSTRAINT "FK_ticket_permission_role_role"
        FOREIGN KEY ("roleId")
        REFERENCES "role"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
      `);
    }

    // Check if roleId column exists in ticket_permission table
    const hasRoleIdColumn = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ticket_permission' 
      AND column_name = 'roleId'
    `);

    if (hasRoleIdColumn.length > 0) {
      // Migrate existing data: copy roleId to join table if not already migrated
      await queryRunner.query(`
        INSERT INTO "ticket_permission_role" ("permissionId", "roleId")
        SELECT id, "roleId"
        FROM "ticket_permission"
        WHERE "roleId" IS NOT NULL
        ON CONFLICT DO NOTHING
      `);

      // Drop the old foreign key constraint if it exists
      await queryRunner.query(`
        ALTER TABLE "ticket_permission" 
        DROP CONSTRAINT IF EXISTS "FK_ticket_permission_role"
      `);

      // Drop roleId column
      await queryRunner.query(`
        ALTER TABLE "ticket_permission" 
        DROP COLUMN IF EXISTS "roleId"
      `);
    }

    // Check if roleName column exists
    const hasRoleNameColumn = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ticket_permission' 
      AND column_name = 'roleName'
    `);

    if (hasRoleNameColumn.length > 0) {
      // Drop roleName column
      await queryRunner.query(`
        ALTER TABLE "ticket_permission" 
        DROP COLUMN IF EXISTS "roleName"
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back roleId column
    await queryRunner.query(`
      ALTER TABLE "ticket_permission" 
      ADD COLUMN "roleId" integer
    `);

    // Add back roleName column
    await queryRunner.query(`
      ALTER TABLE "ticket_permission" 
      ADD COLUMN "roleName" character varying
    `);

    // Restore roleId from first role in join table
    await queryRunner.query(`
      UPDATE "ticket_permission" tp
      SET "roleId" = (
        SELECT "roleId" 
        FROM "ticket_permission_role" tpr
        WHERE tpr."permissionId" = tp.id
        LIMIT 1
      )
    `);

    // Add foreign key constraint back
    await queryRunner.query(`
      ALTER TABLE "ticket_permission"
      ADD CONSTRAINT "FK_ticket_permission_role"
      FOREIGN KEY ("roleId")
      REFERENCES "role"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // Note: ticket_permission_role table is kept for potential rollback
    // You can manually drop it if needed:
    // DROP TABLE "ticket_permission_role";
  }
}
