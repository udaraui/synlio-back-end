import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Company } from '../../company-management/company/company.entity';
import { User } from '../../user-management/user/user.entity';
import { NotificationAttachment } from './notification-attachment/notification-attachment.entity';

@Entity()
export class Notification extends BaseEntity {
  @Column({ type: 'text', nullable: true })
  from: string;

  @Column({ type: 'text', nullable: true })
  to: string;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Company Relation
  @Column({ nullable: true })
  companyId: number;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  // User Relation
  @Column({ nullable: true })
  userId: number;

  @Column({ nullable: true })
  username: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text', nullable: true })
  attachmentPath: string;

  @OneToMany(
    () => NotificationAttachment,
    (attachment) => attachment.notification,
  )
  attachments: NotificationAttachment[];

  @Column({ default: false })
  isSent: boolean;

  @Column({ default: false })
  isRead: boolean;

  // Reference to the source record (e.g. ticket id)
  @Column({ nullable: true })
  referenceId: number;

  // Type of source record (e.g. 'ticket', 'task')
  @Column({ type: 'varchar', nullable: true })
  referenceType: string;

  // Space/context id for the reference (e.g. ticketSpaceId)
  @Column({ nullable: true })
  referenceSpaceId: number;
}
