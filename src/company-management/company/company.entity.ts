import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';
import { Division } from '../division/division.entity';
import { ActiveStatus } from '../../common/enum/status.enum';
import { BaseEntity } from '../../common/base/base.entity';
import { User } from '../../user-management/user/user.entity';
import { Calendar } from '../../resource-management/calendar/calendar.entity';
import { Resource } from '../../resource-management/resource/resource.entity';
import { ResourcePool } from '../../resource-management/resource-pool/resource-pool.entity';
import { UserCompanyRole } from '../../user-management/user/user-company-role.entity';
import { Role } from '../../user-management/role/role.entity';
import { EmailProvider } from '../../common/enum/email-provider.enum';
import { MeetingProvider } from '../../meetings-integration/entities/meeting-integration-connection.entity';

@Entity()
export class Company extends BaseEntity {
  @Column()
  company: string;

  @Column()
  company_code: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ type: 'date', nullable: true })
  suspend_on: Date;

  // ── Notification email config ──────────────────────────────────────────
  @Column({ nullable: true })
  notificationEmail: string;

  @Column({
    type: 'enum',
    enum: EmailProvider,
    nullable: true,
    comment: 'SMTP provider used for outbound notifications',
  })
  emailProvider: EmailProvider;

  @Column({
    nullable: true,
    select: false,
    comment: 'App password / API key for SMTP auth',
  })
  notificationEmailPassword: string;
  // ──────────────────────────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: ActiveStatus,
    default: ActiveStatus.ACTIVE,
  })
  isActive: ActiveStatus;

  @Column({
    type: 'simple-array',
    nullable: true,
    default: 'teams,zoom,google_meet',
  })
  allowedMeetingProviders: MeetingProvider[];

  @ManyToMany(() => User, (user) => user.companies)
  users: User[];

  @OneToMany(() => Division, (division) => division.company)
  divisions: Division[];

  @OneToMany(() => Calendar, (calendar) => calendar.company)
  calendars: Calendar[];

  @OneToMany(() => Resource, (resource) => resource.company)
  resources: Resource[];

  @OneToMany(() => ResourcePool, (rp) => rp.company)
  resourcepools: ResourcePool[];


  @OneToMany(() => UserCompanyRole, (ucr) => ucr.user)
  userCompanyRoles: UserCompanyRole[];

  @OneToMany(() => Role, (role) => role.company)
  roles: Role[];
}
