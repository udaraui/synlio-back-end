import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyIdDivisionIdAndIndexToTicket1777900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add companyId column
    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD COLUMN IF NOT EXISTS "companyId" integer NULL
    `);

    // 2. Add divisionId column
    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD COLUMN IF NOT EXISTS "divisionId" integer NULL
    `);

    // 3. Add foreign key for companyId
    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_companyId"
      FOREIGN KEY ("companyId") REFERENCES "company" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // 4. Add foreign key for divisionId
    await queryRunner.query(`
      ALTER TABLE "ticket"
      ADD CONSTRAINT "FK_ticket_divisionId"
      FOREIGN KEY ("divisionId") REFERENCES "division" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // 5. Backfill companyId and divisionId from the related ticket_space
    await queryRunner.query(`
      UPDATE "ticket" t
      SET
        "companyId"  = ts."companyId",
        "divisionId" = ts."divisionId"
      FROM "ticket_space" ts
      WHERE t."ticketSpaceId" = ts."id"
    `);

    // 6. Create composite index on (statusId, ticketSpaceId)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ticket_statusId_ticketSpaceId"
      ON "ticket" ("statusId", "ticketSpaceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_statusId_ticketSpaceId"`,
    );

    // Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE "ticket" DROP CONSTRAINT IF EXISTS "FK_ticket_divisionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket" DROP CONSTRAINT IF EXISTS "FK_ticket_companyId"`,
    );

    // Drop columns
    await queryRunner.query(
      `ALTER TABLE "ticket" DROP COLUMN IF EXISTS "divisionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ticket" DROP COLUMN IF EXISTS "companyId"`,
    );
  }
}

