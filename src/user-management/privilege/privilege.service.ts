import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Privilege } from './privilege.entity';
import { Repository } from 'typeorm';
import { ActiveStatus } from '../../common/enum/status.enum';

@Injectable()
export class PrivilegeService {
  constructor(
    @InjectRepository(Privilege)
    private privilegeRepository: Repository<Privilege>,
  ) {}

  getAllPrivilege() {
    return this.privilegeRepository.find({
      order: { id: 'asc' },
    });
  }

  createPrivilege(privilege: any) {
    let newPrivilege: any = new Privilege();
    newPrivilege = { ...privilege };
    if (!newPrivilege.id || newPrivilege.id === 0) {
      delete newPrivilege.id;
    }
    return this.privilegeRepository.save(newPrivilege);
  }

  getAllPrivilegeByRole(roleId: number) {
    return this.privilegeRepository.find({
      where: {
        roles: {
          id: roleId,
        },
      },
      relations: ['roles'],
    });
  }

  getAllPrivilegeByUser(userId: number) {
    const activeStatusString = ActiveStatus.ACTIVE;

    return this.privilegeRepository
      .createQueryBuilder('privilege')
      .innerJoin('privilege.roles', 'role')
      .innerJoin('role.userCompanyRoles', 'ucr')
      .innerJoin('ucr.company', 'company')
      .where('ucr.userId = :userId', { userId })

      .andWhere('company.isActive = :companyIsActive', {
        companyIsActive: ActiveStatus.ACTIVE,
      })

      .andWhere('role.isActive = :roleIsActive', { roleIsActive: true })
      .getMany();
  }

  // Alternative method that returns unique privileges with role information
  // getAllPrivilegeByUserWithRoles(userId: number) {
  //   return this.privilegeRep ository
  //     .createQueryBuilder('privilege')
  //     .leftJoin('privilege.roles', 'role')
  //     .leftJoin('role.userCompanyRoles', 'ucr')
  //     .leftJoin('ucr.company', 'company')
  //     .select([
  //       'privilege.id',
  //       'privilege.privilege',
  //       'privilege.group',
  //       'privilege.access_key',
  //       'role.id',
  //       'role.role',
  //       'company.id',
  //       'company.name'
  //     ])
  //     .where('ucr.userId = :userId', { userId })
  //     .andWhere('company.active_status = :activeStatus', { activeStatus: true })
  //     .andWhere('role.active_status = :roleActiveStatus', { roleActiveStatus: true })
  //     .getMany();
  // }
}
