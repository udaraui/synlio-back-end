import { Entity, Column, Unique, Index } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { PostType } from '../enum/post-type.enum';

export { PostType };

@Entity('post_sequence')
@Unique(['companyId', 'spaceId', 'postType', 'levelPrefix', 'parentTaskId'])
@Index('IDX_companyId_spaceId_postType_levelPrefix_parentTaskId', [
  'companyId',
  'spaceId',
  'postType',
  'levelPrefix',
  'parentTaskId',
])
export class PostSequence extends BaseEntity {
  @Column({ type: 'int' })
  companyId: number;

  @Column({ type: 'int' })
  spaceId: number;

  @Column({
    type: 'enum',
    enum: PostType,
    enumName: 'post_type_enum',
  })
  postType: PostType;

  @Column({ type: 'varchar', nullable: true })
  levelPrefix: string | null;

  @Column({ type: 'int', nullable: true })
  levelSequence: number | null;

  @Column({ type: 'int', nullable: true })
  parentTaskId: number | null;

  @Column({ type: 'int', default: 1 })
  nextNumber: number;
}
