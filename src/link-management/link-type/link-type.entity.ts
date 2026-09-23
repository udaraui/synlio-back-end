import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { PostType } from '../../common/enum/post-type.enum';

@Entity('link_type')
@Index(['name', 'postType'], { unique: true })
export class LinkType extends BaseEntity {
  @Column({ nullable: false })
  name: string;

  /** Explains the purpose and usage of this link type. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Reciprocal label shown on the *other* item's detail view (e.g. "Blocks"
   *  pairs with a targetName of "Depends On"). Falls back to `name` when not
   *  set, so symmetric types (e.g. "Relates To") can leave this empty. */
  @Column({ type: 'varchar', nullable: true })
  targetName: string | null;

  /** Which kind of work item this link type applies to: 'Task' or 'Ticket'. */
  @Column({ type: 'varchar', length: 20, default: PostType.TSK })
  postType: PostType;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  icon: string;

  /** Marks the default ("Linked") link type used when none is chosen. */
  @Column({ default: false })
  isDefault: boolean;
}
