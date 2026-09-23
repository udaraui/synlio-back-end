import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { PostType } from '../enum/post-type.enum';

@Entity()
export class Severity extends BaseEntity {
  @Column({ unique: false })
  name: string;

  @Column()
  color: string;

  @Column({ type: 'enum', enum: PostType, nullable: true })
  postType: PostType | null;

}
