import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';

@Entity()
export class CommentAttachment extends BaseEntity {
  @Column({ type: 'text', nullable: false })
  link: string;

  @Column({ nullable: false })
  commentId: number;

  @ManyToOne('Comment', 'commentAttachments', {
    nullable: false,
  })
  @JoinColumn({ name: 'commentId' })
  comment: any;
}
