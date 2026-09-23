-- ============================================================================
-- Ticket Event Logger Functions and Triggers
-- ============================================================================
-- Description : Automatically logs ticket lifecycle changes to ticket_event.
-- Tables monitored :
--   • ticket              → TICKET_CREATED, TICKET_UPDATED
--   • ticket_attachment   → TICKET_ATTACHMENT_UPLOADED, TICKET_ATTACHMENT_DELETED
--   • ticket_participants → TICKET_PARTICIPANT_ADDED,   TICKET_PARTICIPANT_REMOVED
-- Versioning  : ticketVersion is incremented (BEFORE trigger) whenever a
--               tracked core field on the ticket row changes.
-- ============================================================================
-- Prerequisites
-- ─────────────────────────────────────────────────────────────────────────────
-- Run migration  AddTicketVersionAndCreateTicketEventTable  BEFORE this script.
-- That migration:
--   • adds  "ticketVersion" INT NOT NULL DEFAULT 0  to the ticket table
--   • creates the ticket_event table
--   • creates performance indexes
-- ============================================================================

-- ============================================================================
-- Drop existing triggers / functions (idempotent)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_ticket_version_manager ON public.ticket;

DROP TRIGGER IF EXISTS trg_ticket_event_logger ON public.ticket;

DROP TRIGGER IF EXISTS trg_ticket_attachment_event_logger ON public.ticket_attachment;

DROP TRIGGER IF EXISTS trg_ticket_participant_event_logger ON public.ticket_participants;

DROP FUNCTION IF EXISTS public.fn_ticket_version_manager ();

DROP FUNCTION IF EXISTS public.fn_ticket_event_logger ();

DROP FUNCTION IF EXISTS public.fn_ticket_attachment_event_logger ();

DROP FUNCTION IF EXISTS public.fn_ticket_participant_event_logger ();

-- ============================================================================
-- 1.  fn_ticket_version_manager  –  BEFORE INSERT / UPDATE on ticket
-- ============================================================================
-- Initialises ticketVersion = 1 on INSERT.
-- Increments   ticketVersion by 1 on UPDATE when any tracked field changes.
-- Must be BEFORE so the TypeORM RETURNING clause receives the updated version.
--
-- Tracked core fields:
--   name, description, statusId, assigneeId, severityId,
--   ticketTypeId, queueId, plannedEffort, actualEffort,
--   statusName, severityName, ticketTypeName, queueName, impactName,
--   slaResponseTime, slaResolutionTime, assigneeName,
--   assigneeProfilePicUrl, slaResponseDeadline, slaResolutionDeadline,
--   completionDate
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_ticket_version_manager()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- ── INSERT: initialise version ────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        NEW."ticketVersion" := 1;
        RETURN NEW;
    END IF;

    -- ── UPDATE: bump only when a tracked core field changed ───────────────
    IF TG_OP = 'UPDATE' THEN
        IF NEW."name" IS DISTINCT FROM OLD."name" OR
           NEW."description" IS DISTINCT FROM OLD."description" OR
           NEW."statusId" IS DISTINCT FROM OLD."statusId" OR
           NEW."assigneeId" IS DISTINCT FROM OLD."assigneeId" OR
           NEW."severityId" IS DISTINCT FROM OLD."severityId" OR
           NEW."ticketTypeId" IS DISTINCT FROM OLD."ticketTypeId" OR
           NEW."queueId" IS DISTINCT FROM OLD."queueId" OR
           NEW."plannedEffort" IS DISTINCT FROM OLD."plannedEffort" OR
           NEW."actualEffort" IS DISTINCT FROM OLD."actualEffort" OR
           NEW."statusName" IS DISTINCT FROM OLD."statusName" OR
           NEW."severityName" IS DISTINCT FROM OLD."severityName" OR
           NEW."ticketTypeName" IS DISTINCT FROM OLD."ticketTypeName" OR
           NEW."queueName" IS DISTINCT FROM OLD."queueName" OR
           NEW."impactName" IS DISTINCT FROM OLD."impactName" OR
           NEW."slaResponseTime" IS DISTINCT FROM OLD."slaResponseTime" OR
           NEW."slaResolutionTime" IS DISTINCT FROM OLD."slaResolutionTime" OR
           NEW."assigneeName" IS DISTINCT FROM OLD."assigneeName" OR
           NEW."assigneeProfilePicUrl" IS DISTINCT FROM OLD."assigneeProfilePicUrl" OR
           NEW."slaResponseDeadline" IS DISTINCT FROM OLD."slaResponseDeadline" OR
           NEW."slaResolutionDeadline" IS DISTINCT FROM OLD."slaResolutionDeadline" OR
           NEW."completionDate" IS DISTINCT FROM OLD."completionDate"
        THEN
            NEW."ticketVersion" := COALESCE(OLD."ticketVersion", 0) + 1;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- BEFORE trigger — runs first so version is ready when the row is written
CREATE TRIGGER trg_ticket_version_manager
BEFORE INSERT OR UPDATE
ON public.ticket
FOR EACH ROW
EXECUTE FUNCTION public.fn_ticket_version_manager();

-- ============================================================================
-- 2.  fn_ticket_event_logger  –  AFTER INSERT / UPDATE on ticket
-- ============================================================================
-- INSERT → event_type = 'TICKET_CREATED'   payload = full new row snapshot
-- UPDATE → event_type = 'TICKET_UPDATED'   payload = diff of changed fields
--          Skipped entirely when ticketVersion did not change (no tracked
--          field was modified, e.g. only updatedAt was touched).
--
-- Must be AFTER so the ticket row exists before FK insert into ticket_event.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_ticket_event_logger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_changes jsonb := '{}'::jsonb;
    v_corr    uuid;
BEGIN
    -- Optional correlation-id (safe if session variable is not set)
    BEGIN
        v_corr := nullif(current_setting('app.correlation_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
        v_corr := NULL;
    END;

    -- ── INSERT ──────────────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.ticket_event (
            "ticketId", "occurredAt", "actorId",
            "eventType", "version", "correlationId", "payload",
            "createdAt", "updatedAt"
        ) VALUES (
            NEW.id,
            now(),
            NEW."createdBy",
            'TICKET_CREATED',
            NEW."ticketVersion",   -- already set to 1 by the BEFORE trigger
            v_corr,
            to_jsonb(NEW) - 'ticketVersion',
            now(), now()
        );
        RETURN NEW;
    END IF;

    -- ── UPDATE ──────────────────────────────────────────────────────────────
    IF TG_OP = 'UPDATE' THEN
        -- No tracked field changed → BEFORE trigger left version unchanged → skip
        IF NEW."ticketVersion" = OLD."ticketVersion" THEN
            RETURN NEW;
        END IF;

        -- ── Build field-level diff payload ──────────────────────────────────

        IF NEW."name" IS DISTINCT FROM OLD."name" THEN
            v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', OLD."name", 'to', NEW."name"));
        END IF;
        IF NEW."description" IS DISTINCT FROM OLD."description" THEN
            v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('from', OLD."description", 'to', NEW."description"));
        END IF;
        IF NEW."statusId" IS DISTINCT FROM OLD."statusId" THEN
            v_changes := v_changes || jsonb_build_object('statusId', jsonb_build_object('from', OLD."statusId", 'to', NEW."statusId"));
        END IF;
        IF NEW."assigneeId" IS DISTINCT FROM OLD."assigneeId" THEN
            v_changes := v_changes || jsonb_build_object('assigneeId', jsonb_build_object('from', OLD."assigneeId", 'to', NEW."assigneeId"));
        END IF;
        IF NEW."severityId" IS DISTINCT FROM OLD."severityId" THEN
            v_changes := v_changes || jsonb_build_object('severityId', jsonb_build_object('from', OLD."severityId", 'to', NEW."severityId"));
        END IF;
        IF NEW."ticketTypeId" IS DISTINCT FROM OLD."ticketTypeId" THEN
            v_changes := v_changes || jsonb_build_object('ticketTypeId', jsonb_build_object('from', OLD."ticketTypeId", 'to', NEW."ticketTypeId"));
        END IF;
        IF NEW."queueId" IS DISTINCT FROM OLD."queueId" THEN
            v_changes := v_changes || jsonb_build_object('queueId', jsonb_build_object('from', OLD."queueId", 'to', NEW."queueId"));
        END IF;
        IF NEW."plannedEffort" IS DISTINCT FROM OLD."plannedEffort" THEN
            v_changes := v_changes || jsonb_build_object('plannedEffort', jsonb_build_object('from', OLD."plannedEffort", 'to', NEW."plannedEffort"));
        END IF;
        IF NEW."actualEffort" IS DISTINCT FROM OLD."actualEffort" THEN
            v_changes := v_changes || jsonb_build_object('actualEffort', jsonb_build_object('from', OLD."actualEffort", 'to', NEW."actualEffort"));
        END IF;
        IF NEW."statusName" IS DISTINCT FROM OLD."statusName" THEN
            v_changes := v_changes || jsonb_build_object('statusName', jsonb_build_object('from', OLD."statusName", 'to', NEW."statusName"));
        END IF;
        IF NEW."severityName" IS DISTINCT FROM OLD."severityName" THEN
            v_changes := v_changes || jsonb_build_object('severityName', jsonb_build_object('from', OLD."severityName", 'to', NEW."severityName"));
        END IF;
        IF NEW."ticketTypeName" IS DISTINCT FROM OLD."ticketTypeName" THEN
            v_changes := v_changes || jsonb_build_object('ticketTypeName', jsonb_build_object('from', OLD."ticketTypeName", 'to', NEW."ticketTypeName"));
        END IF;
        IF NEW."queueName" IS DISTINCT FROM OLD."queueName" THEN
            v_changes := v_changes || jsonb_build_object('queueName', jsonb_build_object('from', OLD."queueName", 'to', NEW."queueName"));
        END IF;
        IF NEW."impactName" IS DISTINCT FROM OLD."impactName" THEN
            v_changes := v_changes || jsonb_build_object('impactName', jsonb_build_object('from', OLD."impactName", 'to', NEW."impactName"));
        END IF;
        IF NEW."slaResponseTime" IS DISTINCT FROM OLD."slaResponseTime" THEN
            v_changes := v_changes || jsonb_build_object('slaResponseTime', jsonb_build_object('from', OLD."slaResponseTime", 'to', NEW."slaResponseTime"));
        END IF;
        IF NEW."slaResolutionTime" IS DISTINCT FROM OLD."slaResolutionTime" THEN
            v_changes := v_changes || jsonb_build_object('slaResolutionTime', jsonb_build_object('from', OLD."slaResolutionTime", 'to', NEW."slaResolutionTime"));
        END IF;
        IF NEW."assigneeName" IS DISTINCT FROM OLD."assigneeName" THEN
            v_changes := v_changes || jsonb_build_object('assigneeName', jsonb_build_object('from', OLD."assigneeName", 'to', NEW."assigneeName"));
        END IF;
        IF NEW."assigneeProfilePicUrl" IS DISTINCT FROM OLD."assigneeProfilePicUrl" THEN
            v_changes := v_changes || jsonb_build_object('assigneeProfilePicUrl', jsonb_build_object('from', OLD."assigneeProfilePicUrl", 'to', NEW."assigneeProfilePicUrl"));
        END IF;
        IF NEW."slaResponseDeadline" IS DISTINCT FROM OLD."slaResponseDeadline" THEN
            v_changes := v_changes || jsonb_build_object('slaResponseDeadline', jsonb_build_object('from', OLD."slaResponseDeadline", 'to', NEW."slaResponseDeadline"));
        END IF;
        IF NEW."slaResolutionDeadline" IS DISTINCT FROM OLD."slaResolutionDeadline" THEN
            v_changes := v_changes || jsonb_build_object('slaResolutionDeadline', jsonb_build_object('from', OLD."slaResolutionDeadline", 'to', NEW."slaResolutionDeadline"));
        END IF;
        IF NEW."completionDate" IS DISTINCT FROM OLD."completionDate" THEN
            v_changes := v_changes || jsonb_build_object('completionDate', jsonb_build_object('from', OLD."completionDate", 'to', NEW."completionDate"));
        END IF;

        INSERT INTO public.ticket_event (
            "ticketId", "occurredAt", "actorId",
            "eventType", "version", "correlationId", "payload",
            "createdAt", "updatedAt"
        ) VALUES (
            NEW.id,
            now(),
            NEW."updatedBy",
            'TICKET_UPDATED',
            NEW."ticketVersion",
            v_corr,
            v_changes,
            now(), now()
        );
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- AFTER trigger — runs after the ticket row is committed → FK constraint is safe
CREATE TRIGGER trg_ticket_event_logger
AFTER INSERT OR UPDATE
ON public.ticket
FOR EACH ROW
EXECUTE FUNCTION public.fn_ticket_event_logger();

-- ============================================================================
-- 3.  fn_ticket_attachment_event_logger  –  AFTER INSERT / DELETE on ticket_attachment
-- ============================================================================
-- INSERT → 'TICKET_ATTACHMENT_UPLOADED'   payload = { attachmentId, link }
-- DELETE → 'TICKET_ATTACHMENT_DELETED'    payload = { attachmentId, link }
-- Version = current ticketVersion at the moment of the attachment change
--           (not incremented — attachments are a sub-entity).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_ticket_attachment_event_logger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket_version int;
    v_corr           uuid;
BEGIN
    BEGIN
        v_corr := nullif(current_setting('app.correlation_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
        v_corr := NULL;
    END;

    -- ── Attachment uploaded ─────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        SELECT "ticketVersion" INTO v_ticket_version
        FROM public.ticket WHERE id = NEW."ticketId";

        INSERT INTO public.ticket_event (
            "ticketId", "occurredAt", "actorId",
            "eventType", "version", "correlationId", "payload",
            "createdAt", "updatedAt"
        ) VALUES (
            NEW."ticketId",
            now(),
            NEW."createdBy",
            'TICKET_ATTACHMENT_UPLOADED',
            COALESCE(v_ticket_version, 0),
            v_corr,
            jsonb_build_object('attachmentId', NEW.id, 'link', NEW."link"),
            now(), now()
        );
        RETURN NEW;
    END IF;

    -- ── Attachment deleted ──────────────────────────────────────────────────
    IF TG_OP = 'DELETE' THEN
        SELECT "ticketVersion" INTO v_ticket_version
        FROM public.ticket WHERE id = OLD."ticketId";

        INSERT INTO public.ticket_event (
            "ticketId", "occurredAt", "actorId",
            "eventType", "version", "correlationId", "payload",
            "createdAt", "updatedAt"
        ) VALUES (
            OLD."ticketId",
            now(),
            OLD."updatedBy",
            'TICKET_ATTACHMENT_DELETED',
            COALESCE(v_ticket_version, 0),
            v_corr,
            jsonb_build_object('attachmentId', OLD.id, 'link', OLD."link"),
            now(), now()
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_ticket_attachment_event_logger
AFTER INSERT OR DELETE
ON public.ticket_attachment
FOR EACH ROW
EXECUTE FUNCTION public.fn_ticket_attachment_event_logger();

-- ============================================================================
-- 4.  fn_ticket_participant_event_logger  –  AFTER INSERT / DELETE on ticket_participants
-- ============================================================================
-- INSERT → 'TICKET_PARTICIPANT_ADDED'    payload = { memberId }
-- DELETE → 'TICKET_PARTICIPANT_REMOVED'  payload = { memberId }
-- Actor  = ticket.updatedBy at the time of the change (best proxy available).
-- Version = current ticketVersion (not incremented).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_ticket_participant_event_logger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket_version int;
    v_actor          varchar;
    v_corr           uuid;
    v_participant_name varchar;
    v_participant_pic  varchar;
BEGIN
    BEGIN
        v_corr := nullif(current_setting('app.correlation_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
        v_corr := NULL;
    END;

    -- ── Participant added ───────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        SELECT "ticketVersion", COALESCE("updatedBy", "createdBy")
        INTO   v_ticket_version, v_actor
        FROM   public.ticket WHERE id = NEW."ticketId";

        SELECT NULLIF(TRIM(COALESCE("userFirstName", '') || ' ' || COALESCE("userLastName", '')), ''), "userProfilePicture"
        INTO   v_participant_name, v_participant_pic
        FROM   public.ticket_space_member WHERE id = NEW."memberId";

        INSERT INTO public.ticket_event (
            "ticketId", "occurredAt", "actorId",
            "eventType", "version", "correlationId", "payload",
            "createdAt", "updatedAt"
        ) VALUES (
            NEW."ticketId",
            now(),
            v_actor,
            'TICKET_PARTICIPANT_ADDED',
            COALESCE(v_ticket_version, 0),
            v_corr,
            jsonb_build_object(
                'memberId', NEW."memberId",
                'name', v_participant_name,
                'profilePicUrl', v_participant_pic
            ),
            now(), now()
        );
        RETURN NEW;
    END IF;

    -- ── Participant removed ─────────────────────────────────────────────────
    IF TG_OP = 'DELETE' THEN
        SELECT "ticketVersion", COALESCE("updatedBy", "createdBy")
        INTO   v_ticket_version, v_actor
        FROM   public.ticket WHERE id = OLD."ticketId";

        SELECT NULLIF(TRIM(COALESCE("userFirstName", '') || ' ' || COALESCE("userLastName", '')), ''), "userProfilePicture"
        INTO   v_participant_name, v_participant_pic
        FROM   public.ticket_space_member WHERE id = OLD."memberId";

        INSERT INTO public.ticket_event (
            "ticketId", "occurredAt", "actorId",
            "eventType", "version", "correlationId", "payload",
            "createdAt", "updatedAt"
        ) VALUES (
            OLD."ticketId",
            now(),
            v_actor,
            'TICKET_PARTICIPANT_REMOVED',
            COALESCE(v_ticket_version, 0),
            v_corr,
            jsonb_build_object(
                'memberId', OLD."memberId",
                'name', v_participant_name,
                'profilePicUrl', v_participant_pic
            ),
            now(), now()
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_ticket_participant_event_logger
AFTER INSERT OR DELETE
ON public.ticket_participants
FOR EACH ROW
EXECUTE FUNCTION public.fn_ticket_participant_event_logger();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION public.fn_ticket_version_manager () IS 'BEFORE trigger: initialises ticketVersion=1 on INSERT; increments it on
UPDATE when any of the following tracked fields change:
name, description, statusId, assigneeId, severityId,
ticketTypeId, queueId, plannedEffort, actualEffort,
statusName, severityName, ticketTypeName, queueName, impactName,
slaResponseTime, slaResolutionTime, assigneeName,
assigneeProfilePicUrl, slaResponseDeadline, slaResolutionDeadline,
completionDate.
Must be BEFORE so the incremented version is returned via TypeORM RETURNING.';

COMMENT ON TRIGGER trg_ticket_version_manager ON public.ticket IS 'BEFORE trigger: manages ticketVersion for INSERT and meaningful UPDATE operations.';

COMMENT ON FUNCTION public.fn_ticket_event_logger () IS 'AFTER trigger: logs TICKET_CREATED (INSERT) and TICKET_UPDATED (UPDATE, diff
payload) to ticket_event. Skips UPDATE events where no tracked field changed.
AFTER placement ensures the ticket row exists before inserting into ticket_event
(FK-safe).';

COMMENT ON TRIGGER trg_ticket_event_logger ON public.ticket IS 'AFTER trigger: logs ticket creation and meaningful updates to ticket_event.';

COMMENT ON FUNCTION public.fn_ticket_attachment_event_logger () IS 'AFTER trigger: logs TICKET_ATTACHMENT_UPLOADED (INSERT) and
TICKET_ATTACHMENT_DELETED (DELETE) to ticket_event.
Records attachmentId and link in the payload. Does not increment ticketVersion.';

COMMENT ON TRIGGER trg_ticket_attachment_event_logger ON public.ticket_attachment IS 'AFTER trigger: logs attachment upload and deletion events to ticket_event.';

COMMENT ON FUNCTION public.fn_ticket_participant_event_logger () IS 'AFTER trigger: logs TICKET_PARTICIPANT_ADDED (INSERT) and
TICKET_PARTICIPANT_REMOVED (DELETE) to ticket_event.
Records memberId in the payload. Does not increment ticketVersion.';

COMMENT ON TRIGGER trg_ticket_participant_event_logger ON public.ticket_participants IS 'AFTER trigger: logs participant add/remove events to ticket_event.';

-- ============================================================================
-- Event type reference
-- ============================================================================
-- Event                         Source table          When
-- ─────────────────────────────────────────────────────────────────────────────
-- TICKET_CREATED                ticket                INSERT
-- TICKET_UPDATED                ticket                UPDATE (tracked fields)
--   payload keys (only changed fields present):
--     name, description, statusId, assigneeId, severityId,
--     ticketTypeId, queueId, plannedEffort, actualEffort,
--     statusName, severityName, ticketTypeName, queueName, impactName,
--     slaResponseTime, slaResolutionTime, assigneeName,
--     assigneeProfilePicUrl, slaResponseDeadline, slaResolutionDeadline,
--     completionDate
-- TICKET_ATTACHMENT_UPLOADED    ticket_attachment     INSERT
-- TICKET_ATTACHMENT_DELETED     ticket_attachment     DELETE
-- TICKET_PARTICIPANT_ADDED      ticket_participants   INSERT
-- TICKET_PARTICIPANT_REMOVED    ticket_participants   DELETE
-- ============================================================================