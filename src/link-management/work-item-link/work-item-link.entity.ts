import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { PostType } from '../../common/enum/post-type.enum';
import { LinkType } from '../link-type/link-type.entity';

/**
 * Polymorphic link between two work items (Task or Ticket). A single row
 * represents the relationship in both directions — queries look at both the
 * source and target sides, so no physical reverse row is stored.
 */
@Entity('work_item_link')
@Index(['sourceType', 'sourceId'])
@Index(['targetType', 'targetId'])
export class WorkItemLink extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  sourceType: PostType;

  @Column({ type: 'int' })
  sourceId: number;

  @Column({ type: 'varchar', length: 20 })
  targetType: PostType;

  @Column({ type: 'int' })
  targetId: number;

  @Column({ type: 'int', nullable: true })
  linkTypeId: number | null;

  /** Denormalized name of the link type at time of linking. */
  @Column({ type: 'varchar', nullable: true })
  linkTypeName: string | null;

  /** Denormalized reciprocal name (linkType.targetName) shown to the target
   *  side of this link at time of linking. */
  @Column({ type: 'varchar', nullable: true })
  linkTargetTypeName: string | null;

  @ManyToOne(() => LinkType, { nullable: true })
  @JoinColumn({ name: 'linkTypeId' })
  linkType: LinkType;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'int', nullable: true })
  companyId: number | null;
}
