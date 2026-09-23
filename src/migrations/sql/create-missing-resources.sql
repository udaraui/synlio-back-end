
-- Check which users need resources created
SELECT
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.email,
    u.mobile_number,
    u.profile_picture,
    u."isActive",
    u."createdBy",
    uc."companyId" as company_id,
    ud."divisionId" as division_id
FROM "user" u
LEFT JOIN resource r ON r.email = u.email
LEFT JOIN LATERAL (
    SELECT uc."companyId"
    FROM user_companies_company uc
    WHERE uc."userId" = u.id
    LIMIT 1
) uc ON true
LEFT JOIN LATERAL (
    SELECT ud."divisionId"
    FROM user_divisions_division ud
    WHERE ud."userId" = u.id
    LIMIT 1
) ud ON true
WHERE r.id IS NULL  -- User doesn't have a resource
  AND uc."companyId" IS NOT NULL  -- User has at least one company
  AND u."isActive" = true;  -- Optional

-- Insert resources for users who don't have them
INSERT INTO resource (
    first_name,
    last_name,
    email,
    mobile,
    working_hours,
    "companyId",
    "divisionId",
    "calendarId",
    profile_pic,
    active_status,
    "createdBy",
    "createdAt",
    "updatedAt"
)
SELECT
    u.first_name,
    u.last_name,
    u.email,
    CASE
        WHEN u.mobile_number IS NOT NULL AND u.mobile_number ~ '^\d+$'
        THEN CAST(u.mobile_number AS INTEGER)
        ELSE NULL
    END as mobile,
    8 as working_hours,  -- Default 8 hours
    uc."companyId",
    ud."divisionId",
    c.calendar_id,  -- First calendar for the company
    u.profile_picture,
    u."isActive" as active_status,
    u."createdBy",
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "user" u
LEFT JOIN resource r ON r.email = u.email
LEFT JOIN LATERAL (
    SELECT uc."companyId"
    FROM user_companies_company uc
    WHERE uc."userId" = u.id
    ORDER BY uc."companyId" ASC
    LIMIT 1
) uc ON true
LEFT JOIN LATERAL (
    SELECT ud."divisionId"
    FROM user_divisions_division ud
    WHERE ud."userId" = u.id
    ORDER BY ud."divisionId" ASC
    LIMIT 1
) ud ON true
LEFT JOIN LATERAL (
    SELECT c.id as calendar_id
    FROM calendar c
    WHERE c."companyId" = uc."companyId"
    ORDER BY c.id ASC
    LIMIT 1
) c ON true
WHERE r.id IS NULL  -- User doesn't have a resource
  AND uc."companyId" IS NOT NULL  -- User has at least one company
  AND u."isActive" = true;  -- Optional