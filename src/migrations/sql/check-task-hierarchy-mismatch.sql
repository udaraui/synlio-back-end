-- ==========================================================================
-- CHECK: tasks whose hierarchyLevelConfigId / snapshot are wrong
-- Logic: code depth (0-based) → sequence in task_space_hierarchy_level_config
--   SWT-P1      → suffix='P1'      → depth 1 → sequence 0  (level 1)
--   SWT-P1-T1   → suffix='P1-T1'   → depth 2 → sequence 1  (level 2)
--   SWT-P1-T1-S1→ suffix='P1-T1-S1'→ depth 3 → sequence 2  (level 3)
-- ==========================================================================
WITH task_depth AS (
    SELECT
        t.id,
        t.code,
        t."taskSpaceId",
        t."hierarchyLevelConfigId"   AS stored_configId,
        t."hierarchyLevelName"       AS stored_name,
        t."hierarchyLevelIcon"       AS stored_icon,
        t."hierarchyLevelColor"      AS stored_color,
        t."hierarchyLevelSequence"   AS stored_sequence,
        ts.prefix,
        -- 0-based sequence: number of code segments after prefix minus 1
        array_length(
                string_to_array(SUBSTRING(t.code FROM LENGTH(ts.prefix) + 2), '-'),
                1
        ) - 1  AS correct_sequence
    FROM tm_task t
             JOIN task_space ts ON ts.id = t."taskSpaceId"
    WHERE t.code IS NOT NULL
      AND t.code ~ ('^' || ts.prefix || '-[A-Z][0-9]')
    )
SELECT
    td.id,
    td.code,
    td."taskSpaceId",
    td.prefix,
    td.correct_sequence,

    -- What is on the task right now
    td.stored_configId,
    td.stored_sequence,
    td.stored_name,
    td.stored_icon,
    td.stored_color,

    -- What it should be
    cfg.id       AS correct_configId,
    cfg.name     AS correct_name,
    cfg.icon     AS correct_icon,
    cfg.color    AS correct_color,

    -- Which columns are wrong
    (td.stored_configId  IS DISTINCT FROM cfg.id)       AS configId_wrong,
    (td.stored_sequence  IS DISTINCT FROM cfg.sequence) AS sequence_wrong,
    (td.stored_name      IS DISTINCT FROM cfg.name)     AS name_wrong,
    (td.stored_icon      IS DISTINCT FROM cfg.icon)     AS icon_wrong,
    (td.stored_color     IS DISTINCT FROM cfg.color)    AS color_wrong

FROM task_depth td
         JOIN task_space_hierarchy_level_config cfg
              ON  cfg."taskSpaceId" = td."taskSpaceId"
                  AND cfg.sequence      = td.correct_sequence
WHERE
    td.stored_configId  IS DISTINCT FROM cfg.id
    OR td.stored_sequence  IS DISTINCT FROM cfg.sequence
    OR td.stored_name      IS DISTINCT FROM cfg.name
    OR td.stored_icon      IS DISTINCT FROM cfg.icon
    OR td.stored_color     IS DISTINCT FROM cfg.color
ORDER BY td.code;

-- ==========================================================================
-- FIX: re-derive hierarchyLevelConfigId from the task code and sync all
--      denormalized snapshot fields from task_space_hierarchy_level_config
-- ==========================================================================
WITH correct_mapping AS (
    SELECT
        t.id                     AS task_id,
        cfg.id                   AS correct_configId,
        cfg.name                 AS correct_name,
        cfg.icon                 AS correct_icon,
        cfg.color                AS correct_color,
        cfg.sequence             AS correct_sequence
    FROM tm_task t
             JOIN task_space ts ON ts.id = t."taskSpaceId"
             JOIN task_space_hierarchy_level_config cfg
                  ON  cfg."taskSpaceId" = t."taskSpaceId"
                      AND cfg.sequence = (
                          array_length(
                                  string_to_array(SUBSTRING(t.code FROM LENGTH(ts.prefix) + 2), '-'),
                                  1
                          ) - 1
                          )
    WHERE t.code IS NOT NULL
      AND t.code ~ ('^' || ts.prefix || '-[A-Z][0-9]')
    )
UPDATE tm_task t
SET
    "hierarchyLevelConfigId" = cm.correct_configId,
    "hierarchyLevelName"     = cm.correct_name,
    "hierarchyLevelIcon"     = cm.correct_icon,
    "hierarchyLevelColor"    = cm.correct_color,
    "hierarchyLevelSequence" = cm.correct_sequence,
    "updatedAt"              = NOW(),
    "updatedBy"              = 'system-sync'
    FROM correct_mapping cm
WHERE t.id = cm.task_id
  AND (
    t."hierarchyLevelConfigId"  IS DISTINCT FROM cm.correct_configId
   OR t."hierarchyLevelName"      IS DISTINCT FROM cm.correct_name
   OR t."hierarchyLevelIcon"      IS DISTINCT FROM cm.correct_icon
   OR t."hierarchyLevelColor"     IS DISTINCT FROM cm.correct_color
   OR t."hierarchyLevelSequence"  IS DISTINCT FROM cm.correct_sequence
    )
    RETURNING
    t.id,
    t.code,
    t."hierarchyLevelConfigId",
    t."hierarchyLevelName",
    t."hierarchyLevelIcon",
    t."hierarchyLevelColor",
    t."hierarchyLevelSequence";
