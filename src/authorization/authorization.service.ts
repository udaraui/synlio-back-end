import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCompanyPrivilegeView } from '../user-management/user/user-company-privilege-view/user-company-privilege.entity';
import { UserCompanyView } from '../user-management/user/user-company-view/user-company.entity';
import { RedisService } from '../redis/redis.service';
import { UserPrivilegeView } from 'src/user-management/user/user-privilege-view/user-privilege.entity';

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(UserCompanyPrivilegeView)
    private userCompanyPrivilegeViewRepository: Repository<UserCompanyPrivilegeView>,

    @InjectRepository(UserPrivilegeView)
    private userPrivilegeViewRepository: Repository<UserPrivilegeView>,

    @InjectRepository(UserCompanyView)
    private UserCompanyViewRepository: Repository<UserCompanyView>,
    private redisService: RedisService,
  ) {}

  // from database
  async getUserCompanyPrivileges(userId: number) {
    return await this.userPrivilegeViewRepository.findOne({
      where: { userId },
    });
  }
  async getAllUserCompanyPrivileges() {
    return await this.userPrivilegeViewRepository.find();
  }

  // from cache
  async getUserCompanyPrivilegesFromCache(userId: number) {
    return await this.redisService.get(`user_privileges:${userId}`);
  }

  async setAllUserCompanyPrivilegesIntoCache() {
    const privileges = await this.userPrivilegeViewRepository.find();

    // Group by userId → companyId → privilegeIds[]
    const userMap = new Map<number, Map<number, number[]>>();
    for (const record of privileges) {
      if (!userMap.has(record.userId)) userMap.set(record.userId, new Map());
      const companyMap = userMap.get(record.userId)!;
      if (!companyMap.has(record.companyId))
        companyMap.set(record.companyId, []);
      companyMap.get(record.companyId)!.push(record.privilegeId);
    }

    for (const [userId, companyMap] of userMap) {
      const payload = Array.from(companyMap.entries()).map(
        ([companyId, privilegeIds]) => ({ companyId, privilegeIds }),
      );
      await this.redisService.set(
        `user_privileges:${userId}`,
        JSON.stringify(payload),
      );
    }
    return true;
  }

  async updateUserCompanyPrivilegesIntoCache(userId: number) {
    await this.redisService.delete(`user_privileges:${userId}`);
    const privileges = await this.userPrivilegeViewRepository.find({
      where: { userId },
    });
    const companyMap = new Map<number, number[]>();
    for (const record of privileges) {
      if (!companyMap.has(record.companyId))
        companyMap.set(record.companyId, []);
      companyMap.get(record.companyId)!.push(record.privilegeId);
    }
    const payload = Array.from(companyMap.entries()).map(
      ([companyId, privilegeIds]) => ({ companyId, privilegeIds }),
    );
    await this.redisService.set(
      `user_privileges:${userId}`,
      JSON.stringify(payload),
    );
  }

  async getUserCompanyByUserId(userId: number) {
    return await this.UserCompanyViewRepository.find({
      where: { userId },
    });
  }

  async deleteUserCompanyPrivilegesFromCache(userId: number) {
    await this.redisService.delete(`user_privileges:${userId}`);
  }

  async invalidateCacheForRole(roleId: number) {
    const affectedUsers = await this.userPrivilegeViewRepository
      .createQueryBuilder('upv')
      .innerJoin(
        'user_company_role',
        'ucr',
        'ucr.userId = upv.userId AND ucr.roleId = :roleId',
        { roleId },
      )
      .select(['upv.userId'])
      .distinct(true)
      .getRawMany();

    for (const user of affectedUsers) {
      const userId = user.upv_userId;

      await this.redisService.delete(`user_privileges:${userId}`);
      const freshPrivileges = await this.userPrivilegeViewRepository.find({
        where: { userId },
      });

      if (freshPrivileges.length > 0) {
        const companyMap = new Map<number, number[]>();
        for (const record of freshPrivileges) {
          if (!companyMap.has(record.companyId))
            companyMap.set(record.companyId, []);
          companyMap.get(record.companyId)!.push(record.privilegeId);
        }
        const payload = Array.from(companyMap.entries()).map(
          ([companyId, privilegeIds]) => ({ companyId, privilegeIds }),
        );
        await this.redisService.set(
          `user_privileges:${userId}`,
          JSON.stringify(payload),
        );
      }
    }
  }
}
