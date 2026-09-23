import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds two pre-computed SLA deadline columns to the ticket table:
 *
 *   slaResponseDeadline   = ticket.createdAt + ticketSla.responseTime  minutes
 *   slaResolutionDeadline = ticket.createdAt + ticketSla.resolutionTime minutes
 *
 * Both columns are:
 *   - TIMESTAMPTZ (timezone-aware)
 *   - Nullable  → NULL means either no SLA assigned OR ticket is Finished
 *   - Indexed   → fast ORDER BY / WHERE on the home dashboard query
 *
 * Backfill: sets values for all existing open tickets that already have a
 * ticketSlaId. Tickets whose status.base = 'Finished' are left as NULL
 * intentionally (breach clock frozen).
 */
export class AddSlaDeadlinesToTicket1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the two columns
    await queryRunner.query(`
      ALTER TABLE "ticket"
        ADD COLUMN IF NOT EXISTS "slaResponseDeadline"   TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "slaResolutionDeadline" TIMESTAMPTZ NULL
    `);

    // 2. Backfill for tickets that have an SLA AND are NOT yet Finished
    //    Formula: ticket.createdAt + (sla.responseTime / resolutionTime) MINUTES
    await queryRunner.query(`
      UPDATE "ticket" t
      SET
        "slaResponseDeadline"   = t."createdAt" + (sla."responseTime"   * INTERVAL '1 minute'),
        "slaResolutionDeadline" = t."createdAt" + (sla."resolutionTime" * INTERVAL '1 minute')
      FROM "ticket_sla" sla
      WHERE t."ticketSlaId" = sla."id"
        -- Only set for non-finished tickets
        AND t."statusId" NOT IN (
          SELECT id FROM "status" WHERE base = 'Finished'
        )
    `);

    // 3. Index on slaResolutionDeadline — used for ORDER BY on dashboard
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ticket_slaResolutionDeadline"
      ON "ticket" ("slaResolutionDeadline")
    `);

    // 4. Composite index (assigneeId, slaResolutionDeadline) — used by my-tickets query
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ticket_assigneeId_slaResolutionDeadline"
      ON "ticket" ("assigneeId", "slaResolutionDeadline")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_assigneeId_slaResolutionDeadline"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ticket_slaResolutionDeadline"`,
    );
    await queryRunner.query(`
      ALTER TABLE "ticket"
        DROP COLUMN IF EXISTS "slaResponseDeadline",
        DROP COLUMN IF EXISTS "slaResolutionDeadline"
    `);
  }
}

