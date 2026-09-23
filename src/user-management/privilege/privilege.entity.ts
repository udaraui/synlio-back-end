import { Column, Entity, ManyToMany, Unique } from 'typeorm';
import { Role } from '../role/role.entity';
import { BaseEntity } from '../../common/base/base.entity';

export enum PrivilegeLevel {
  ENV = 'env',
  CONFIG = 'config',
  DATA = 'data',
}

@Entity()
@Unique('Privilege-access_key', ['access_key'])
export class Privilege extends BaseEntity {
  @Column({ primary: true, unique: true })
  declare id: number;

  @Column()
  privilege: string;

  @Column()
  group: string;

  @Column({ unique: true })
  access_key: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PrivilegeLevel,
    default: PrivilegeLevel.DATA,
  })
  level_type: PrivilegeLevel;

  @ManyToMany(() => Role, (role) => role.privileges)
  roles: Role[];
}
