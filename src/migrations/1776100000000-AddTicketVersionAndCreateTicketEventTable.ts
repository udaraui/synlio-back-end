import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddTicketVersionAndCreateTicketEventTable
 *
 * Changes:
 *  1. Adds  "ticketVersion" INT NOT NULL DEFAULT 0  to the  ticket  table.
 *     The DB triggers (fn_ticket_version_manager) will set it to 1 on first
 *     INSERT and increment it on every meaningful core-field UPDATE.
 *
 *  2. Creates the  ticket_event  table – the audit log for all ticket
 *     lifecycle events (creation, field updates, attachment changes,
 *     participant changes).  The table is populated exclusively by
 *     PostgreSQL triggers defined in:
 *       src/migrations/sql/ticket-event-logger-function.sql
 *
 * Apply the SQL trigger script manually (or via a seed/init script) AFTER
 * running this migration.
 */
export class AddTicketVersionAndCreateTicketEventTable1776100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Add ticketVersion to ticket ──────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE public.ticket
      ADD COLUMN IF NOT EXISTS "ticketVersion" integer NOT NULL DEFAULT 0;
    `);

    // ── 2. Create ticket_event table ────────────────────────────────────────
    // MUST be created BEFORE the backfill UPDATE below, because an existing
    // DB trigger (fn_ticket_event_logger) fires on every ticket UPDATE and
    // tries to INSERT into ticket_event. Creating the table first prevents
    // "relation does not exist" errors during the backfill.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.ticket_event (
        "id"            bigserial       NOT NULL,
        "createdAt"     timestamp       NOT NULL DEFAULT now(),
        "updatedAt"     timestamp       NOT NULL DEFAULT now(),
        "createdBy"     varchar(50)     NULL,
        "updatedBy"     varchar(50)     NULL,
        "ticketId"      integer         NOT NULL,
        "occurredAt"    timestamp       NOT NULL DEFAULT now(),
        "actorId"       varchar         NULL,
        "eventType"     varchar         NOT NULL,
        "version"       integer         NOT NULL DEFAULT 0,
        "correlationId" uuid            NULL,
        "payload"       jsonb           NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "PK_ticket_event" PRIMARY KEY ("id")
      );
    `);

    // ── 3. Indexes ───────────────────────────────────────────────────────────

    // Primary access pattern: all events for a ticket ordered by time
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_ticket_event_ticket_time"
      ON public.ticket_event USING btree ("ticketId", "occurredAt" DESC);
    `);

    // Efficient filtering by event type
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_ticket_event_type"
      ON public.ticket_event USING btree ("eventType");
    `);

    // Efficient actor look-ups (who changed what)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IX_ticket_event_actor"
      ON public.ticket_event USING btree ("actorId")
      WHERE "actorId" IS NOT NULL;
    `);

    // ── 4. Foreign key: ticket_event → ticket (CASCADE DELETE) ──────────────
    await queryRunner.query(`
      ALTER TABLE public.ticket_event
      ADD CONSTRAINT "FK_ticket_event_ticket"
      FOREIGN KEY ("ticketId")
      REFERENCES public.ticket (id)
      ON DELETE CASCADE;
    `);

    // ── 5. Backfill ticketVersion ────────────────────────────────────────────
    // Done AFTER ticket_event exists so the fn_ticket_event_logger trigger
    // (which fires on UPDATE) can write audit rows.
    await queryRunner.query(`
      UPDATE public.ticket SET "ticketVersion" = 1 WHERE "ticketVersion" = 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop ticket_event (cascades constraints + indexes)
    await queryRunner.query(`
      DROP TABLE IF EXISTS public.ticket_event CASCADE;
    `);

    // Remove ticketVersion from ticket
    await queryRunner.query(`
      ALTER TABLE public.ticket
      DROP COLUMN IF EXISTS "ticketVersion";
    `);
  }
}
