import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from '../../../company-management/company/company.entity';
import { BaseEntity } from '../../../common/base/base.entity';

@Entity()
export class SkillCategories extends BaseEntity {
  @Column()
  name: string;

  @Column()
  description: string;

  @ManyToOne(() => Company, (company) => company.id)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ default: true })
  isActive: boolean;
}
