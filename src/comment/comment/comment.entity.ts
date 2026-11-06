import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { PostType } from '../../common/enum/post-type.enum';
import { CommentAttachment } from '../comment-attachment/comment-attachment.entity';

@Entity()
@Index(['id', 'postType'])
export class Comment extends BaseEntity {
  @Column({ nullable: true })
  parentId: number;

  @ManyToOne(() => Comment, (comment) => comment.childComments, {
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parentComment: Comment;

  @OneToMany(() => Comment, (comment) => comment.parentComment)
  childComments: Comment[];

  @Column({ type: 'text', nullable: false })
  comment: string;

  @Column({ nullable: false })
  postId: number;

  @Column({ type: 'enum', enum: PostType, nullable: false })
  postType: PostType;

  @Index('IDX_comment_userId')
  @Column({ type: 'integer', nullable: false })
  userId: number;

  @Column({ type: 'varchar', nullable: false })
  userEmail: string;

  @Column({ type: 'varchar', nullable: false })
  username: string;

  @Column({ type: 'text', nullable: true })
  profilePicture: string | null;

  @OneToMany(() => CommentAttachment, (attachment) => attachment.comment)
  commentAttachments: CommentAttachment[];
}
