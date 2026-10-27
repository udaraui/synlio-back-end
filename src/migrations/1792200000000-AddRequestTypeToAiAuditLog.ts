import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestTypeToAiAuditLog1792200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add column if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE "ai_audit_logs" 
      ADD COLUMN IF NOT EXISTS "requestType" character varying(32) NOT NULL DEFAULT 'analytics';
    `);

    // 2. Create index
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ai_audit_request_type" ON "ai_audit_logs" ("requestType");
    `);

    // 3. Backfill existing records based on nodeWiseUsage
    await queryRunner.query(`
      UPDATE "ai_audit_logs"
      SET "requestType" = CASE
        WHEN "nodeWiseUsage" ? 'automation_extract_delta' OR "nodeWiseUsage" ? 'automation_finalize' OR "nodeWiseUsage" ? 'automation_clarify' THEN 'automation'
        WHEN "nodeWiseUsage" ? 'orchestrator' OR "nodeWiseUsage" ? 'ticket_analytics' OR "nodeWiseUsage" ? 'project_analytics' OR "nodeWiseUsage" ? 'resource_analytics' OR "nodeWiseUsage" ? 'tool_executor' THEN 'analytics'
        ELSE 'general_chat'
      END
      WHERE "nodeWiseUsage" IS NOT NULL AND "nodeWiseUsage" != '{}'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_ai_audit_request_type";
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_audit_logs" DROP COLUMN IF EXISTS "requestType";
    `);
  }
}
