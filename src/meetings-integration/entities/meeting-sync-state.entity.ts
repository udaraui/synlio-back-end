import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { MeetingProvider } from './meeting-integration-connection.entity';

export enum SyncStatus {
  OK = 'ok',
  ERROR = 'error',
}

@Entity('meeting_sync_state')
@Index('IDX_mss_userId_provider', ['userId', 'provider'], { unique: true })
export class MeetingSyncState extends BaseEntity {
  @Column({ nullable: false })
  userId: number;

  @Column({
    type: 'enum',
    enum: MeetingProvider,
    enumName: 'meeting_provider_enum',
    nullable: false,
  })
  provider: MeetingProvider;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  /**
   * Provider-specific incremental sync token.
   * Teams: @odata.deltaLink, Google: syncToken, Zoom: N/A
   */
  @Column({ type: 'text', nullable: true })
  deltaToken: string | null;

  @Column({
    type: 'enum',
    enum: SyncStatus,
    enumName: 'sync_status_enum',
    default: SyncStatus.OK,
    nullable: false,
  })
  lastStatus: SyncStatus;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;
}
