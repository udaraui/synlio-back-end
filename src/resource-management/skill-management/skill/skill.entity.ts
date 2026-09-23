import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SkillCategories } from '../skill-category/skill-category.entity';
import { BaseEntity } from '../../../common/base/base.entity';

@Entity()
export class Skill extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => SkillCategories, (category) => category.id)
  @JoinColumn({ name: 'categoryId' })
  category: SkillCategories;

  @Column({ default: true })
  isActive: boolean;
}
