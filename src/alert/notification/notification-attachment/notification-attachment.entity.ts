import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';
import { Notification } from '../notification.entity';

@Entity()
export class NotificationAttachment extends BaseEntity {
  @Column({ type: 'text', nullable: false })
  link: string;

  @Column({ nullable: false })
  notificationId: number;

  @ManyToOne(() => Notification, (notification) => notification.attachments, {
    nullable: false,
  })
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;
}
