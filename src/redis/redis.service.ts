import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { UserCompanyView } from 'src/user-management/user/user-company-view/user-company.entity';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private redis: Redis) {}

  onModuleDestroy() {
    this.redis.quit();
  }

  /**
   * Executes a Redis operation and swallows any error with a WARN log.
   * Redis is a cache layer only — failures must never crash HTTP requests.
   */
  private async safeExec<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await operation();
    } catch (err: any) {
      this.logger.warn(`Redis operation failed (non-fatal): ${err?.message}`);
      return fallback;
    }
  }

  // ── Low-level primitives ────────────────────────────────────────────────

  async set(key: string, value: string, ttlInSeconds?: number): Promise<void> {
    await this.safeExec(async () => {
      if (ttlInSeconds) {
        await this.redis.set(key, value, 'EX', ttlInSeconds);
      } else {
        await this.redis.set(key, value);
      }
    }, undefined);
  }

  async get(key: string): Promise<string | null> {
    return this.safeExec(() => this.redis.get(key), null);
  }

  async delete(key: string): Promise<void> {
    await this.safeExec(() => this.redis.del(key).then(() => undefined), undefined);
  }

  async deleteMulti(keys: string[]): Promise<void> {
    if (!keys || keys.length === 0) return;
    // Execute individual deletes in parallel to avoid CROSSSLOT errors on Azure Redis Cluster
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.safeExec(async () => {
      await this.redis.hset(key, field, value);
    }, undefined);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.safeExec(() => this.redis.hget(key, field), null);
  }

  getClient(): Redis {
    return this.redis;
  }

  async deleteByPattern(pattern: string): Promise<void> {
    await this.safeExec(async () => {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        // ioredis keys() returns strings WITH the prefix included.
        // del() automatically prepends the prefix to its arguments.
        // We must strip the prefix from the returned keys before passing to del() to avoid double-prefixing.
        const prefix = this.redis.options.keyPrefix || '';
        const strippedKeys = keys.map(k => k.startsWith(prefix) ? k.slice(prefix.length) : k);
        await this.redis.del(...strippedKeys);
      }
    }, undefined);
  }

  async setUserCompanies(
    userId: string | number,
    companies: UserCompanyView[],
  ) {
    const key = `user_companies:${userId}`;
    await this.set(key, JSON.stringify(companies));
  }

  async getUserCompanies(userId: string | number): Promise<UserCompanyView[]> {
    const key = `user_companies:${userId}`;
    const data = await this.get(key);
    return data ? JSON.parse(data) : [];
  }

  async updateUserCompanies(
    userId: string | number,
    companies: UserCompanyView[],
  ) {
    await this.setUserCompanies(userId, companies);
  }

  async deleteUserCompanies(userId: string | number) {
    const key = `user_companies:${userId}`;
    await this.delete(key);
  }

  // ── Task Space Config ────────────────────────────────────────────────

  async setTaskSpaceConfig(spaceId: number, config: any): Promise<void> {
    const key = `task_space_config:${spaceId}`;
    await this.set(key, JSON.stringify(config));
  }

  async getTaskSpaceConfig(spaceId: number): Promise<object | null> {
    const key = `task_space_config:${spaceId}`;
    const data = await this.get(key);
    return data ? (JSON.parse(data) as object) : null;
  }

  async deleteTaskSpaceConfig(spaceId: number): Promise<void> {
    const key = `task_space_config:${spaceId}`;
    await this.delete(key);
  }

  // ── Ticket Space Config ──────────────────────────────────────────────

  async setTicketSpaceConfig(spaceId: number, config: any): Promise<void> {
    const key = `ticket_space_config:${spaceId}`;
    await this.set(key, JSON.stringify(config));
  }

  async getTicketSpaceConfig(spaceId: number): Promise<object | null> {
    const key = `ticket_space_config:${spaceId}`;
    const data = await this.get(key);
    return data ? (JSON.parse(data) as object) : null;
  }

  async deleteTicketSpaceConfig(spaceId: number): Promise<void> {
    const key = `ticket_space_config:${spaceId}`;
    await this.delete(key);
  }

  // ── Precise User Visibility Cache Invalidation ───────────────────────

  async setTicketSpaceMemberships(userId: number, spaceIds: number[]): Promise<void> {
    const key = `user_accessible_ticket_spaces:${userId}`;
    await this.set(key, JSON.stringify(spaceIds));
  }

  async invalidateUserTaskSpacesByEmail(email: string): Promise<void> {
    if (!email) return;
    await this.delete(`user_accessible_task_spaces:userId_${email.toLowerCase()}`);
  }

  async invalidateMultipleUsersTaskSpaces(emails: string[]): Promise<void> {
    if (!emails || emails.length === 0) return;
    const keys = emails.map(e => `user_accessible_task_spaces:userId_${e.toLowerCase()}`);
    await this.deleteMulti(keys);
  }

  async invalidateUserTicketSpaces(userId: number): Promise<void> {
    if (!userId) return;
    await this.delete(`user_accessible_ticket_spaces:${userId}`);
  }
}
