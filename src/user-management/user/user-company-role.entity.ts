import { User } from './user.entity';
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
} from 'typeorm';
import { Role } from '../role/role.entity';
import { Company } from '../../company-management/company/company.entity';

@Entity()
@Index(['userId', 'companyId', 'roleId'], { unique: true })
export class UserCompanyRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({nullable: true})
  companyId: number;

  @Column()
  roleId: number;

  @ManyToOne(() => User, (user) => user.userCompanyRoles, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Company, { eager: true })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'roleId' })
  role: Role;
}
