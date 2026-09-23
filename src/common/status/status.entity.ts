import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Company } from '../../company-management/company/company.entity';
import { PostType } from '../enum/post-type.enum';
import { StatusBaseEnum } from '../enum/status-base.enum';

@Entity()
export class Status extends BaseEntity {
  @Column({ unique: false })
  name: string;

  @Column()
  color: string;

  @Column({ type: 'enum', enum: PostType, nullable: true })
  postType: PostType | null;

  @Column({ type: 'enum', enum: StatusBaseEnum, nullable: true })
  base: StatusBaseEnum | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  isPrimaryBase: boolean | null;
}
