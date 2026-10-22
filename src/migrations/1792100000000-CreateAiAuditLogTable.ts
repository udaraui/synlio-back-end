import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiAuditLogTable1792100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_audit_logs" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdBy" character varying(50),
        "updatedBy" character varying(50),
        "requestId" character varying(64) NOT NULL,
        "conversationId" character varying(64) NOT NULL,
        "companyId" integer NOT NULL,
        "userId" integer NOT NULL,
        "userEmail" character varying(255),
        "userName" character varying(255),
        "chatMode" character varying(32) NOT NULL DEFAULT 'panel',
        "userQuery" text NOT NULL,
        "finalResponse" text,
        "status" character varying(32) NOT NULL DEFAULT 'SUCCESS',
        "totalLatencyMs" integer NOT NULL DEFAULT 0,
        "inToken" integer NOT NULL DEFAULT 0,
        "outToken" integer NOT NULL DEFAULT 0,
        "cacheToken" integer NOT NULL DEFAULT 0,
        "totalTokens" integer NOT NULL DEFAULT 0,
        "nodeWiseUsage" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "errorMessage" text,
        CONSTRAINT "PK_ai_audit_logs_id" PRIMARY KEY ("id")
      );

      CREATE INDEX IF NOT EXISTS "idx_ai_audit_request" ON "ai_audit_logs" ("requestId");
      CREATE INDEX IF NOT EXISTS "idx_ai_audit_conversation" ON "ai_audit_logs" ("conversationId");
      CREATE INDEX IF NOT EXISTS "idx_ai_audit_company_created" ON "ai_audit_logs" ("companyId", "createdAt");
      CREATE INDEX IF NOT EXISTS "idx_ai_audit_user_created" ON "ai_audit_logs" ("userId", "createdAt");
      CREATE INDEX IF NOT EXISTS "idx_ai_audit_status" ON "ai_audit_logs" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "ai_audit_logs";
    `);
  }
}
