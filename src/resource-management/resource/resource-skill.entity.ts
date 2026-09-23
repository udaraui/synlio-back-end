import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Resource } from './resource.entity';
import { SkillLevel } from '../skill-management/skill-level/skill-level.entity';
import { Skill } from '../skill-management/skill/skill.entity';
import { SkillCategories } from '../skill-management/skill-category/skill-category.entity';
import { BaseEntity } from '../../common/base/base.entity';

@Entity()
export class ResourceSkill extends BaseEntity {
  @Column({ nullable: true })
  resourceId: number;

  @ManyToOne(() => Resource, (resource) => resource.resourceSkills)
  @JoinColumn({ name: 'resourceId' })
  resource: Resource;

  //..............................

  @Column({ nullable: true })
  skillId: number;

  @ManyToOne(() => Skill)
  @JoinColumn({ name: 'skillId' })
  skill: Skill;

  @Column({ nullable: true })
  skillName: string;


  //..............................

  @Column({ nullable: true })
  skillLevelId: number;

  @ManyToOne(() => SkillLevel)
  @JoinColumn({ name: 'skillLevelId' })
  skillLevel: SkillLevel;

  @Column({ nullable: true })
  skillLevelName: string;

  @Column({ nullable: true })
  starCount: number;

  //..............................

  @Column({ nullable: true })
  skillCategoryId: number;

  @ManyToOne(() => SkillCategories)
  @JoinColumn({ name: 'skillCategoryId' })
  skillCategory: SkillCategories;

  @Column({ nullable: true })
  skillCategoryName: string;

  //..............................

  @Column({ nullable: true })
  companyId: number;
}
