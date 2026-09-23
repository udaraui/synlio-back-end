-- ============================================================================
-- Remove Task Event Logger Triggers
-- ============================================================================
-- Migration to remove database triggers that cause foreign key violations
-- ============================================================================

-- Drop existing event logger triggers (all known variants)
DROP TRIGGER IF EXISTS trg_task_event_logger        ON public.task;
DROP TRIGGER IF EXISTS trg_task_event_logger_insert ON public.task;
DROP TRIGGER IF EXISTS trg_task_event_logger_update ON public.task;

-- Drop version manager trigger (introduced in the two-trigger fix)
DROP TRIGGER IF EXISTS trg_task_version_manager     ON public.task;

-- Drop trigger functions
DROP FUNCTION IF EXISTS public.fn_task_event_logger();
DROP FUNCTION IF EXISTS public.fn_task_version_manager();

-- ============================================================================
-- COMPLETED
-- ============================================================================

