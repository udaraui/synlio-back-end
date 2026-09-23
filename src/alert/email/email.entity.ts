import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Company } from '../../company-management/company/company.entity';
import { User } from '../../user-management/user/user.entity';
import { EmailAttachment } from './email-attachment/email-attachment.entity';

@Entity()
export class Email extends BaseEntity {
  @Column({ type: 'text', nullable: true })
  from: string;

  @Column({ type: 'text', nullable: true })
  to: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Comma-separated CC recipients',
  })
  ccTo: string;

  @Column({ type: 'text', nullable: true })
  subject: string;

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

  @OneToMany('EmailAttachment', (attachment: any) => attachment.email)
  attachments: EmailAttachment[];

  @Column({ default: false })
  isSent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiredAt: Date;

  @Column({ type: 'text', nullable: true })
  image: string;

  @Column({ default: false })
  isError: boolean;

  @Column({ type: 'text', nullable: true })
  errorText: string;

  @Column({ nullable: true })
  spaceId: number;

  // Reference to the source record (e.g. ticket id)
  @Column({ nullable: true })
  referenceId: number;

  // Type of source record (e.g. 'ticket')
  @Column({ type: 'varchar', nullable: true })
  referenceType: string;
}
