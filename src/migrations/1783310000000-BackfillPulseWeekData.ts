import { MigrationInterface, QueryRunner } from "typeorm";

export class BackfillPulseWeekData1783310000000 implements MigrationInterface {
    name = 'BackfillPulseWeekData1783310000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Update existing pulse_week records based on their related pulse records
        const emptyPulseWeeks = await queryRunner.query(`
            SELECT pw.id, p."createdAt"
            FROM "pulse_week" pw
            INNER JOIN "pulse" p ON p."pulseWeekId" = pw.id
            WHERE (pw."weekStartDate" IS NULL OR pw."weekEndDate" IS NULL)
            AND p."createdAt" IS NOT NULL
            ORDER BY pw.id, p."createdAt" ASC
        `);

        const updatedWeeks = new Set();
        for (const row of emptyPulseWeeks) {
            if (updatedWeeks.has(row.id)) continue;

            const createdAt = new Date(row.createdAt);
            const dayOfWeek = createdAt.getDay(); // 0 is Sunday, 1 is Monday...
            
            // Assume week starts on Monday for business logic
            const diffToMonday = createdAt.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const weekStartDate = new Date(createdAt.setDate(diffToMonday));
            weekStartDate.setHours(0, 0, 0, 0);

            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekStartDate.getDate() + 6);
            weekEndDate.setHours(23, 59, 59, 999);

            const weekStartDateStr = weekStartDate.toISOString().split('T')[0];
            const weekEndDateStr = weekEndDate.toISOString().split('T')[0];

            await queryRunner.query(`
                UPDATE "pulse_week"
                SET "weekStartDate" = $1, "weekEndDate" = $2
                WHERE id = $3
            `, [weekStartDateStr, weekEndDateStr, row.id]);

            updatedWeeks.add(row.id);
        }

        // 2. Find pulses without pulseWeekId (Orphans)
        const orphanPulses = await queryRunner.query(`
            SELECT id, "createdAt", "createdBy", "companyId"
            FROM "pulse"
            WHERE "pulseWeekId" IS NULL OR "pulseWeekId" = 0
        `);

        for (const pulse of orphanPulses) {
            const createdAt = new Date(pulse.createdAt);
            const dayOfWeek = createdAt.getDay(); 
            
            const diffToMonday = createdAt.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const weekStartDate = new Date(createdAt.setDate(diffToMonday));
            weekStartDate.setHours(0, 0, 0, 0);

            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekStartDate.getDate() + 6);
            weekEndDate.setHours(23, 59, 59, 999);

            const weekStartDateStr = weekStartDate.toISOString().split('T')[0];
            const weekEndDateStr = weekEndDate.toISOString().split('T')[0];

            // Check if pulse_week already exists for this week, company, and user
            const existingPulseWeeks = await queryRunner.query(`
                SELECT id 
                FROM "pulse_week"
                WHERE "companyId" = $1 AND "weekStartDate" = $2 AND "userEmail" = $3
            `, [pulse.companyId, weekStartDateStr, pulse.createdBy]);

            let pulseWeekId;

            if (existingPulseWeeks.length > 0) {
                pulseWeekId = existingPulseWeeks[0].id;
            } else {
                const users = await queryRunner.query(`
                    SELECT id, email, username 
                    FROM "user"
                    WHERE email = $1
                `, [pulse.createdBy]);

                if (users.length > 0) {
                    const user = users[0];
                    const result = await queryRunner.query(`
                        INSERT INTO "pulse_week" (
                            "companyId", "weekStartDate", "weekEndDate", "status", 
                            "userId", "userEmail", "userFullName", 
                            "synlioActivityTime", "meetingTime", "needAttentionCount", "taskFromMeetingCount", "missingTime",
                            "createdAt", "updatedAt"
                        ) VALUES (
                            $1, $2, $3, 'DRAFT', 
                            $4, $5, $6, 
                            0, 0, 0, 0, 0,
                            now(), now()
                        ) RETURNING id
                    `, [pulse.companyId, weekStartDateStr, weekEndDateStr, user.id, user.email, user.username]);
                    
                    pulseWeekId = result[0].id;
                }
            }

            if (pulseWeekId) {
                await queryRunner.query(`
                    UPDATE "pulse"
                    SET "pulseWeekId" = $1
                    WHERE id = $2
                `, [pulseWeekId, pulse.id]);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverting this is difficult as we don't know which pulseWeekIds were added or modified
    }
}
