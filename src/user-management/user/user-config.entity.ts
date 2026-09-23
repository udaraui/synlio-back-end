import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { User } from './user.entity';
import { BaseEntity } from '../../common/base/base.entity';

@Entity('user_config')
export class UserConfig extends BaseEntity {
  @Column()
  userId: number;

  @Column({ type: 'varchar', nullable: true, default: 'system' })
  theme: string;

  @Column({ type: 'jsonb', nullable: true })
  viewPreference: any;

  @Column({ type: 'jsonb', nullable: true })
  filterPreference: any;

  @Column({ type: 'jsonb', nullable: true })
  filterTemplates: any;

  @Column({ type: 'jsonb', nullable: true })
  quickActionConfig: any;

  @Column({ type: 'varchar', nullable: true, default: 'default' })
  primaryColor: string;

  @Column({ type: 'varchar', nullable: true, default: 'default' })
  sidebarColor: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
