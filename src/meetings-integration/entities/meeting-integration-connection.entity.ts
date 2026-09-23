import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { User } from '../../user-management/user/user.entity';

export enum MeetingProvider {
  TEAMS = 'teams',
  ZOOM = 'zoom',
  GOOGLE_MEET = 'google_meet',
  SLACK = 'slack',
  INTERNAL = 'internal',
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  ERROR = 'error',
  REVOKED = 'revoked',
}

@Entity('meeting_integration_connection')
@Index('IDX_mic_userId_provider', ['userId', 'provider'], { unique: true })
export class MeetingIntegrationConnection extends BaseEntity {
  @Column({ nullable: false })
  userId: number;

  @Column({
    type: 'enum',
    enum: MeetingProvider,
    enumName: 'meeting_provider_enum',
    nullable: false,
  })
  provider: MeetingProvider;

  @Column({ type: 'text', nullable: false })
  accessToken: string;

  @Column({ type: 'text', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  scopes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerUserId: string | null;

  /**
   * Teams: tenantId, Zoom: accountId, Slack: workspaceId
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  tenantId: string | null;

  @Column({
    type: 'enum',
    enum: ConnectionStatus,
    enumName: 'connection_status_enum',
    default: ConnectionStatus.CONNECTED,
    nullable: false,
  })
  status: ConnectionStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastConnectedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
