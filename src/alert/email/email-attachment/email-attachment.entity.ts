import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';
import { Email } from '../email.entity';

@Entity()
export class EmailAttachment extends BaseEntity {
  @Column({ type: 'text', nullable: false })
  link: string;

  @Column({ nullable: false })
  emailId: number;

  @ManyToOne(() => Email, (email) => email.attachments, { nullable: false })
  @JoinColumn({ name: 'emailId' })
  email: Email;
}
