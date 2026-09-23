-- ============================================================================
-- Task Event Logger Functions and Triggers
-- ============================================================================
-- Description : Automatically logs task lifecycle changes to tm_task_event.
-- Tables monitored :
--   • tm_task              → TASK_CREATED, TASK_UPDATED
--   • tm_task_attachment   → TASK_ATTACHMENT_UPLOADED, TASK_ATTACHMENT_DELETED
--   • tm_task_co_assignees → TASK_CO_ASSIGNEE_ADDED,   TASK_CO_ASSIGNEE_REMOVED
-- Versioning  : taskVersion is incremented (BEFORE trigger) whenever a
--               tracked core field on the task row changes.
-- ============================================================================
-- Prerequisites
-- ─────────────────────────────────────────────────────────────────────────────
-- Run a migration that:
--   • adds  "taskVersion" INT NOT NULL DEFAULT 0  to the tm_task table
--   • creates the tm_task_event table
--   • creates performance indexes
-- ============================================================================

-- ============================================================================
-- Drop existing triggers / functions (idempotent)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_task_version_manager ON public.tm_task;
DROP TRIGGER IF EXISTS trg_task_event_logger ON public.tm_task;
DROP TRIGGER IF EXISTS trg_task_attachment_event_logger ON public.tm_task_attachment;
DROP TRIGGER IF EXISTS trg_task_co_assignee_event_logger ON public.tm_task_co_assignees;

DROP FUNCTION IF EXISTS public.fn_task_version_manager() CASCADE;
DROP FUNCTION IF EXISTS public.fn_task_event_logger() CASCADE;
DROP FUNCTION IF EXISTS public.fn_task_attachment_event_logger() CASCADE;
DROP FUNCTION IF EXISTS public.fn_task_co_assignee_event_logger() CASCADE;


-- 1. Drop the old, incorrect foreign key constraint first
--ALTER TABLE "public"."task_event"
--DROP CONSTRAINT IF EXISTS "task_event_task_id_fkey";
--
-- 2. Add the new, correct foreign key constraint pointing to tm_task
--ALTER TABLE "public"."tm_task_event"
--ADD CONSTRAINT "task_event_task_id_fkey"
--FOREIGN KEY ("taskId") REFERENCES "public"."tm_task"("id");


-- ============================================================================
-- 1.  fn_task_version_manager  –  BEFORE INSERT / UPDATE on tm_task
-- ============================================================================
-- Initialises taskVersion = 1 on INSERT.
-- Increments   taskVersion by 1 on UPDATE when any tracked field changes.
-- Must be BEFORE so the TypeORM RETURNING clause receives the updated version.
--
-- Tracked core fields:
--   name, description, statusId, severityId, assigneeId,
--   dueDate, progressPercentage, companyId, divisionId,
--   special, estimateEffort, actualEffort, completionDate,
--   actualStartDate, actualEndDate, statusName, severityName,
--   assigneeName, assigneeProfilePicUrl
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_task_version_manager()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- ── INSERT: initialise version ────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        NEW."taskVersion" := 1;
RETURN NEW;
END IF;

    -- ── UPDATE: bump only when a tracked core field changed ───────────────
    IF TG_OP = 'UPDATE' THEN
        IF NEW.name                IS DISTINCT FROM OLD.name               OR
           NEW.description         IS DISTINCT FROM OLD.description        OR
           NEW."statusId"          IS DISTINCT FROM OLD."statusId"          OR
           NEW."severityId"        IS DISTINCT FROM OLD."severityId"        OR
           NEW."assigneeId"        IS DISTINCT FROM OLD."assigneeId"       OR
           NEW."dueDate"           IS DISTINCT FROM OLD."dueDate"          OR
           NEW."progressPercentage" IS DISTINCT FROM OLD."progressPercentage" OR
           NEW."companyId"         IS DISTINCT FROM OLD."companyId"        OR
           NEW."divisionId"        IS DISTINCT FROM OLD."divisionId"        OR
           NEW.special             IS DISTINCT FROM OLD.special             OR
           NEW."estimateEffort"    IS DISTINCT FROM OLD."estimateEffort"    OR
           NEW."actualEffort"      IS DISTINCT FROM OLD."actualEffort"      OR
           NEW."completionDate"    IS DISTINCT FROM OLD."completionDate"    OR
           NEW."actualStartDate"   IS DISTINCT FROM OLD."actualStartDate"   OR
           NEW."actualEndDate"     IS DISTINCT FROM OLD."actualEndDate"     OR
           NEW."statusName"        IS DISTINCT FROM OLD."statusName"        OR
           NEW."severityName"      IS DISTINCT FROM OLD."severityName"      OR
           NEW."assigneeName"      IS DISTINCT FROM OLD."assigneeName"      OR
           NEW."assigneeProfilePicUrl" IS DISTINCT FROM OLD."assigneeProfilePicUrl"
        THEN
            NEW."taskVersion" := COALESCE(OLD."taskVersion", 0) + 1;
END IF;
RETURN NEW;
END IF;

RETURN NEW;
END;
$$;

-- BEFORE trigger — runs first so version is ready when the row is written
CREATE TRIGGER trg_task_version_manager
    BEFORE INSERT OR UPDATE
                         ON public.tm_task
                         FOR EACH ROW
                         EXECUTE FUNCTION public.fn_task_version_manager();

-- ============================================================================
-- 2.  fn_task_event_logger  –  AFTER INSERT / UPDATE on tm_task
-- ============================================================================
-- INSERT → event_type = 'TASK_CREATED'   payload = full new row snapshot
-- UPDATE → event_type = 'TASK_UPDATED'   payload = diff of changed fields
--          Skipped entirely when taskVersion did not change.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_task_event_logger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
v_changes jsonb := '{}'::jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.tm_task_event (
            "taskId", "occurredAt", "actorId",
            "eventType", "version", "payload"
        ) VALUES (
            NEW.id, now(), NEW."createdBy", 'TASK_CREATED',
            NEW."taskVersion", to_jsonb(NEW) - 'taskVersion'
        );
RETURN NEW;
END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW."taskVersion" = OLD."taskVersion" THEN
            RETURN NEW;
END IF;

        IF NEW.name IS DISTINCT FROM OLD.name THEN
            v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name));
END IF;
        IF NEW.description IS DISTINCT FROM OLD.description THEN
            v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('from', OLD.description, 'to', NEW.description));
END IF;
        IF NEW."statusId" IS DISTINCT FROM OLD."statusId" THEN
            v_changes := v_changes || jsonb_build_object('statusId', jsonb_build_object('from', OLD."statusId", 'to', NEW."statusId"));
END IF;
        IF NEW."severityId" IS DISTINCT FROM OLD."severityId" THEN
            v_changes := v_changes || jsonb_build_object('severityId', jsonb_build_object('from', OLD."severityId", 'to', NEW."severityId"));
END IF;
        IF NEW."assigneeId" IS DISTINCT FROM OLD."assigneeId" THEN
            v_changes := v_changes || jsonb_build_object('assigneeId', jsonb_build_object('from', OLD."assigneeId", 'to', NEW."assigneeId"));
END IF;
        IF NEW."dueDate" IS DISTINCT FROM OLD."dueDate" THEN
            v_changes := v_changes || jsonb_build_object('dueDate', jsonb_build_object('from', OLD."dueDate", 'to', NEW."dueDate"));
END IF;
        IF NEW."progressPercentage" IS DISTINCT FROM OLD."progressPercentage" THEN
            v_changes := v_changes || jsonb_build_object('progressPercentage', jsonb_build_object('from', OLD."progressPercentage", 'to', NEW."progressPercentage"));
END IF;
        IF NEW."companyId" IS DISTINCT FROM OLD."companyId" THEN
            v_changes := v_changes || jsonb_build_object('companyId', jsonb_build_object('from', OLD."companyId", 'to', NEW."companyId"));
END IF;
        IF NEW."divisionId" IS DISTINCT FROM OLD."divisionId" THEN
            v_changes := v_changes || jsonb_build_object('divisionId', jsonb_build_object('from', OLD."divisionId", 'to', NEW."divisionId"));
END IF;
        IF NEW.special IS DISTINCT FROM OLD.special THEN
            v_changes := v_changes || jsonb_build_object('special', jsonb_build_object('from', OLD.special, 'to', NEW.special));
END IF;
        IF NEW."estimateEffort" IS DISTINCT FROM OLD."estimateEffort" THEN
            v_changes := v_changes || jsonb_build_object('estimateEffort', jsonb_build_object('from', OLD."estimateEffort", 'to', NEW."estimateEffort"));
END IF;
        IF NEW."actualEffort" IS DISTINCT FROM OLD."actualEffort" THEN
            v_changes := v_changes || jsonb_build_object('actualEffort', jsonb_build_object('from', OLD."actualEffort", 'to', NEW."actualEffort"));
END IF;
        IF NEW."completionDate" IS DISTINCT FROM OLD."completionDate" THEN
            v_changes := v_changes || jsonb_build_object('completionDate', jsonb_build_object('from', OLD."completionDate", 'to', NEW."completionDate"));
END IF;
        IF NEW."actualStartDate" IS DISTINCT FROM OLD."actualStartDate" THEN
            v_changes := v_changes || jsonb_build_object('actualStartDate', jsonb_build_object('from', OLD."actualStartDate", 'to', NEW."actualStartDate"));
END IF;
        IF NEW."actualEndDate" IS DISTINCT FROM OLD."actualEndDate" THEN
            v_changes := v_changes || jsonb_build_object('actualEndDate', jsonb_build_object('from', OLD."actualEndDate", 'to', NEW."actualEndDate"));
END IF;
        IF NEW."statusName" IS DISTINCT FROM OLD."statusName" THEN
            v_changes := v_changes || jsonb_build_object('statusName', jsonb_build_object('from', OLD."statusName", 'to', NEW."statusName"));
END IF;
        IF NEW."severityName" IS DISTINCT FROM OLD."severityName" THEN
            v_changes := v_changes || jsonb_build_object('severityName', jsonb_build_object('from', OLD."severityName", 'to', NEW."severityName"));
END IF;
        IF NEW."assigneeName" IS DISTINCT FROM OLD."assigneeName" THEN
            v_changes := v_changes || jsonb_build_object('assigneeName', jsonb_build_object('from', OLD."assigneeName", 'to', NEW."assigneeName"));
END IF;
        IF NEW."assigneeProfilePicUrl" IS DISTINCT FROM OLD."assigneeProfilePicUrl" THEN
            v_changes := v_changes || jsonb_build_object('assigneeProfilePicUrl', jsonb_build_object('from', OLD."assigneeProfilePicUrl", 'to', NEW."assigneeProfilePicUrl"));
END IF;

INSERT INTO public.tm_task_event (
    "taskId", "occurredAt", "actorId",
    "eventType", "version", "payload"
) VALUES (
             NEW.id, now(), NEW."updatedBy", 'TASK_UPDATED',
             NEW."taskVersion", v_changes
         );
RETURN NEW;
END IF;

RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_event_logger
    AFTER INSERT OR UPDATE
                        ON public.tm_task
                        FOR EACH ROW
                        EXECUTE FUNCTION public.fn_task_event_logger();

-- ============================================================================
-- 3. fn_task_attachment_event_logger – AFTER INSERT/DELETE on tm_task_attachment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_task_attachment_event_logger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
v_task_version int;
BEGIN
    IF TG_OP = 'INSERT' THEN
SELECT "taskVersion" INTO v_task_version FROM public.tm_task WHERE id = NEW."taskId";
INSERT INTO public.tm_task_event (
    "taskId", "occurredAt", "actorId", "eventType",
    "version", "payload"
) VALUES (
             NEW."taskId", now(), NEW."createdBy", 'TASK_ATTACHMENT_UPLOADED',
             COALESCE(v_task_version, 0),
             jsonb_build_object('attachmentId', NEW.id, 'link', NEW."link")
         );
RETURN NEW;
END IF;

    IF TG_OP = 'DELETE' THEN
        -- Check if the parent task still exists. If not, this is a cascading
        -- delete, and we should not log this event to avoid a FK error.
        PERFORM 1 FROM public.tm_task WHERE id = OLD."taskId";
        IF NOT FOUND THEN
            RETURN OLD;
END IF;

SELECT "taskVersion" INTO v_task_version FROM public.tm_task WHERE id = OLD."taskId";
INSERT INTO public.tm_task_event (
    "taskId", "occurredAt", "actorId", "eventType",
    "version", "payload"
) VALUES (
             OLD."taskId", now(), OLD."updatedBy", 'TASK_ATTACHMENT_DELETED',
             COALESCE(v_task_version, 0),
             jsonb_build_object('attachmentId', OLD.id, 'link', OLD."link")
         );
RETURN OLD;
END IF;

RETURN NULL;
END;
$$;

CREATE TRIGGER trg_task_attachment_event_logger
    AFTER INSERT OR DELETE
ON public.tm_task_attachment
FOR EACH ROW
EXECUTE FUNCTION public.fn_task_attachment_event_logger();

-- ============================================================================
-- 4. fn_task_co_assignee_event_logger – AFTER INSERT/DELETE on tm_task_co_assignees
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_task_co_assignee_event_logger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_task_version int;
    v_actor        varchar;
    v_resource_name varchar;
    v_resource_pic  varchar;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT "taskVersion", COALESCE("updatedBy", "createdBy") INTO v_task_version, v_actor
        FROM public.tm_task WHERE id = NEW."taskId";

        SELECT TRIM(first_name || ' ' || COALESCE(last_name, '')), profile_pic 
        INTO v_resource_name, v_resource_pic
        FROM public.resource WHERE id = NEW."resourceId";

        INSERT INTO public.tm_task_event (
            "taskId", "occurredAt", "actorId", "eventType",
            "version", "payload"
        ) VALUES (
            NEW."taskId", now(), v_actor, 'TASK_CO_ASSIGNEE_ADDED',
            COALESCE(v_task_version, 0),
            jsonb_build_object(
                'resourceId', NEW."resourceId",
                'name', v_resource_name,
                'profilePicUrl', v_resource_pic
            )
        );
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        -- Check if the parent task still exists. If not, this is a cascading
        -- delete, and we should not log this event to avoid a FK error.
        PERFORM 1 FROM public.tm_task WHERE id = OLD."taskId";
        IF NOT FOUND THEN
            RETURN OLD;
        END IF;

        SELECT "taskVersion", COALESCE("updatedBy", "createdBy") INTO v_task_version, v_actor
        FROM public.tm_task WHERE id = OLD."taskId";

        SELECT TRIM(first_name || ' ' || COALESCE(last_name, '')), profile_pic 
        INTO v_resource_name, v_resource_pic
        FROM public.resource WHERE id = OLD."resourceId";

        INSERT INTO public.tm_task_event (
            "taskId", "occurredAt", "actorId", "eventType",
            "version", "payload"
        ) VALUES (
            OLD."taskId", now(), v_actor, 'TASK_CO_ASSIGNEE_REMOVED',
            COALESCE(v_task_version, 0),
            jsonb_build_object(
                'resourceId', OLD."resourceId",
                'name', v_resource_name,
                'profilePicUrl', v_resource_pic
            )
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_task_co_assignee_event_logger
    AFTER INSERT OR DELETE
ON public.tm_task_co_assignees
FOR EACH ROW
EXECUTE FUNCTION public.fn_task_co_assignee_event_logger();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION public.fn_task_version_manager() IS 'BEFORE trigger: initialises taskVersion=1 on INSERT; increments it on UPDATE when any tracked field changes.';
COMMENT ON TRIGGER trg_task_version_manager ON public.tm_task IS 'BEFORE trigger: manages taskVersion for INSERT and meaningful UPDATE operations.';
COMMENT ON FUNCTION public.fn_task_event_logger() IS 'AFTER trigger: logs TASK_CREATED and TASK_UPDATED to tm_task_event.';
COMMENT ON TRIGGER trg_task_event_logger ON public.tm_task IS 'AFTER trigger: logs task creation and meaningful updates to tm_task_event.';
COMMENT ON FUNCTION public.fn_task_attachment_event_logger() IS 'AFTER trigger: logs TASK_ATTACHMENT_UPLOADED and TASK_ATTACHMENT_DELETED to tm_task_event. Skips logging on cascading deletes.';
COMMENT ON TRIGGER trg_task_attachment_event_logger ON public.tm_task_attachment IS 'AFTER trigger: logs attachment upload and deletion events to tm_task_event.';
COMMENT ON FUNCTION public.fn_task_co_assignee_event_logger() IS 'AFTER trigger: logs TASK_CO_ASSIGNEE_ADDED and TASK_CO_ASSIGNEE_REMOVED to tm_task_event. Skips logging on cascading deletes.';
COMMENT ON TRIGGER trg_task_co_assignee_event_logger ON public.tm_task_co_assignees IS 'AFTER trigger: logs co-assignee add/remove events to tm_task_event.';

-- ============================================================================
-- Event type reference
-- ============================================================================
-- Event                         Source table             When
-- ─────────────────────────────────────────────────────────────────────────────
-- TASK_CREATED                  tm_task                  INSERT
-- TASK_UPDATED                  tm_task                  UPDATE (tracked fields)
--   payload keys (only changed fields present):
--     name                → title change
--     description         → description change
--     statusId            → status ID change
--     severityId          → severity ID change
--     assigneeId          → assignment change
--     dueDate             → due date change
--     progressPercentage  → progress change
--     companyId           → company change
--     divisionId          → division change
--     special             → special status change
--     estimateEffort      → estimated effort change
--     actualEffort        → actual effort change
--     completionDate      → completion date change
--     actualStartDate     → actual start date change
--     actualEndDate       → actual end date change
--     statusName          → status name change
--     severityName        → severity name change
--     assigneeName        → assignee name change
--     assigneeProfilePicUrl → assignee profile picture URL change
-- TASK_ATTACHMENT_UPLOADED      tm_task_attachment       INSERT
-- TASK_ATTACHMENT_DELETED       tm_task_attachment       DELETE
-- TASK_CO_ASSIGNEE_ADDED        tm_task_co_assignees     INSERT
-- TASK_CO_ASSIGNEE_REMOVED      tm_task_co_assignees     DELETE
-- ============================================================================
