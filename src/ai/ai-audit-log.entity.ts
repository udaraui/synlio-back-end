import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base/base.entity';
import { NodeUsageDetailDto } from './dto/ai-audit-payload.dto';

@Entity('ai_audit_logs')
@Index('idx_ai_audit_request', ['requestId'])
@Index('idx_ai_audit_conversation', ['conversationId'])
@Index('idx_ai_audit_company_created', ['companyId', 'createdAt'])
@Index('idx_ai_audit_user_created', ['userId', 'createdAt'])
@Index('idx_ai_audit_status', ['status'])
export class AiAuditLog extends BaseEntity {
  // ── Correlation & User Context ──────────────────────────────────────────
  @Column({ type: 'varchar', length: 64, nullable: false })
  requestId: string;

  @Column({ type: 'varchar', length: 64, nullable: false })
  conversationId: string;

  @Column({ type: 'int', nullable: false })
  companyId: number;

  @Column({ type: 'int', nullable: false })
  userId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userName: string | null;

  @Column({ type: 'varchar', length: 32, nullable: false, default: 'panel' })
  chatMode: string; // 'panel' | 'full'

  // ── High-Level Conversation & Result ────────────────────────────────────
  @Column({ type: 'text', nullable: false })
  userQuery: string;

  @Column({ type: 'text', nullable: true })
  finalResponse: string | null;

  @Column({ type: 'varchar', length: 32, nullable: false, default: 'SUCCESS' })
  status: string; // 'SUCCESS' | 'INJECTION_BLOCKED' | 'NO_DOMAIN_FALLBACK' | 'FAILED'

  @Column({ type: 'int', nullable: false, default: 0 })
  totalLatencyMs: number;

  // ── Cumulative Token Metrics ────────────────────────────────────────────
  @Column({ type: 'int', nullable: false, default: 0 })
  inToken: number;

  @Column({ type: 'int', nullable: false, default: 0 })
  outToken: number;

  @Column({ type: 'int', nullable: false, default: 0 })
  cacheToken: number;

  @Column({ type: 'int', nullable: false, default: 0 })
  totalTokens: number;

  // ── Node-Wise Breakdown (JSON Column with Input, Output, Tokens, Time) ───
  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  nodeWiseUsage: Record<string, NodeUsageDetailDto>;

  // ── Error Details (if applicable) ───────────────────────────────────────
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;
}
