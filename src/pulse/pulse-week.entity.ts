import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base/base.entity';
import { PulseSnapshotStatus } from '../common/enum/pulse-snapshot-status.enum';
import { User } from '../user-management/user/user.entity';
import { Resource } from '../resource-management/resource/resource.entity';
import { Pulse } from './pulse.entity';

@Entity('pulse_week')
export class PulseWeek extends BaseEntity {
  @OneToMany(() => Pulse, (pulse) => pulse.pulseWeek)
  pulses: Pulse[];
  @Column({ nullable: false })
  companyId: number;

  @Column({ type: 'date', nullable: false })
  weekStartDate: Date;

  @Column({ type: 'date', nullable: false })
  weekEndDate: Date;

  @Column({
    type: 'enum',
    enum: PulseSnapshotStatus,
    enumName: 'pulse_snapshot_status_enum',
    default: PulseSnapshotStatus.PENDING,
  })
  status: PulseSnapshotStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  submittedAt: Date;

  @ManyToOne(() => User, (user) => user.pulseWeeks)
  user: User;

  @Column({ nullable: false })
  userId: number;

  @Column()
  userEmail: string;

  @Column()
  userFullName: string;

  @Column({ nullable: true })
  userProfilePicture: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  synlioActivityTime: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  meetingTime: number;

  @Column({ type: 'int', nullable: true })
  needAttentionCount: number;

  @Column({ type: 'int', nullable: true })
  taskFromMeetingCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  missingTime: number;

  @ManyToOne(() => Resource, { nullable: true })
  @JoinColumn({ name: 'submittedToId' })
  submittedTo: Resource;

  @Column({ nullable: true })
  submittedToId: number;

  @Column()
  submittedToEmail: string;

  @Column()
  submittedToFullName: string;

  @Column({ nullable: true })
  submittedToProfilePicture: string;

  @ManyToOne(() => Resource, { nullable: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: Resource;

  @Column({ nullable: true })
  approvedById: number;

  @Column({ nullable: true })
  approvedByEmail: string;

  @Column({ nullable: true })
  approvedByFullName: string;

  @Column({ nullable: true })
  approvedByProfilePicture: string;

  @Column({ nullable: true })
  rejectReason: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  responsedAt: Date;
}