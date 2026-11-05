import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from './company.entity';

@Entity('company_crm')
export class CompanyCrm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', unique: true })
  companyId: number;

  @Column({ name: 'employee_count', type: 'varchar', nullable: true })
  employee_count: string | null;

  @Column({ name: 'manage_type', type: 'varchar', nullable: true })
  manage_type: string | null;

  @Column({ name: 'optional_data', type: 'varchar', nullable: true })
  optional_data: string | null;

  @OneToOne(() => Company, (company) => company.crm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;
}

