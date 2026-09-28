import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { SpaceAlertRule } from './space-alert-rule.entity';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { User } from '../../user-management/user/user.entity';

// ─── Resolver types (used by TaskAlertService + TicketAlertService) ──────── //

export interface AlertResolverContext {
  /** Who triggered this specific event */
  actorEmail: string;
  actorUserId: number | null;
  /** Who originally created the task / ticket */
  createdByEmail: string;
  createdByUserId: number | null;
  /** Current assignee */
  assigneeEmail: string | null;
  assigneeUserId: number | null;
  /** Task space: co-assignees */
  coAssigneeEmails: string[];
  coAssigneeUserIds: number[];
  /** Task space: member watchers (grouped under toCoAssignees) */
  memberEmails: string[];
  memberUserIds: number[];
  /** Ticket space: participants */
  participantEmails: string[];
  participantUserIds: number[];
}

export interface ResolvedAlert {
  sendEmail: boolean;
  sendInApp: boolean;
  toEmails: string[];
  ccEmails: string[];
  /** Union of TO + CC user ids (for in-app notifications) */
  notifUserIds: number[];
  /** userId → email map for notification `to` field */
  notifUserEmailMap: Map<number, string>;
}

// ─────────────────────────────────────────────────────────────────────────── //

@Injectable()
export class AlertRuleService {
  private readonly logger = new Logger(AlertRuleService.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────── //

  async findBySpace(
    spaceType: string,
    spaceId: number,
  ): Promise<SpaceAlertRule[]> {
    return this.entityManager.find(SpaceAlertRule, {
      where: { spaceType, spaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: number): Promise<SpaceAlertRule> {
    const rule = await this.entityManager.findOne(SpaceAlertRule, {
      where: { id },
    });
    if (!rule) throw new NotFoundException(`Alert rule #${id} not found`);
    return rule;
  }

  async create(
    dto: CreateAlertRuleDto,
    authUser: any,
  ): Promise<SpaceAlertRule> {
    const rule = this.entityManager.create(SpaceAlertRule, {
      name: dto.name,
      spaceType: dto.spaceType,
      spaceId: dto.spaceId,
      events: dto.events ?? [],
      channel: dto.channel,
      toAssignee: dto.toAssignee ?? false,
      toCoAssignees: dto.toCoAssignees ?? false,
      toParticipants: dto.toParticipants ?? false,
      toCreator: dto.toCreator ?? false,
      toActor: dto.toActor ?? false,
      toAdditionalUserIds: dto.toAdditionalUserIds ?? [],
      ccAssignee: dto.ccAssignee ?? false,
      ccCoAssignees: dto.ccCoAssignees ?? false,
      ccParticipants: dto.ccParticipants ?? false,
      ccCreator: dto.ccCreator ?? false,
      ccActor: dto.ccActor ?? false,
      ccAdditionalUserIds: dto.ccAdditionalUserIds ?? [],
      isActive: dto.isActive ?? true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      createdBy: authUser?.email as string,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      updatedBy: authUser?.email as string,
    });
    return this.entityManager.save(SpaceAlertRule, rule);
  }

  async update(
    id: number,
    dto: UpdateAlertRuleDto,
    authUser: any,
  ): Promise<SpaceAlertRule> {
    const rule = await this.findOne(id);
    Object.assign(rule, {
      ...dto,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      updatedBy: authUser?.email as string,
    });
    return this.entityManager.save(SpaceAlertRule, rule);
  }

  async toggle(id: number, authUser: any): Promise<SpaceAlertRule> {
    const rule = await this.findOne(id);
    rule.isActive = !rule.isActive;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    rule.updatedBy = authUser?.email as string;
    return this.entityManager.save(SpaceAlertRule, rule);
  }

  async remove(id: number): Promise<void> {
    const rule = await this.findOne(id);
    await this.entityManager.remove(SpaceAlertRule, rule);
  }

  // ── User search (for @mention in rule dialog) ──────────────────────────── //

  async searchUsers(query: string, companyId?: number): Promise<User[]> {
    const qb = this.entityManager
      .createQueryBuilder(User, 'u')
      .select(['u.id', 'u.email', 'u.first_name', 'u.last_name'])
      .where(
        '(u.email ILIKE :q OR u.first_name ILIKE :q OR u.last_name ILIKE :q)',
        { q: `%${query}%` },
      );

    if (companyId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM user_company uc WHERE uc."userId" = u.id AND uc."companyId" = :companyId)',
        { companyId },
      );
    }

    return qb.take(10).getMany();
  }

  async getUsersByIds(ids: number[]): Promise<User[]> {
    if (!ids.length) return [];
    const { In } = await import('typeorm');
    return this.entityManager.find(User, {
      where: { id: In(ids) },
      select: ['id', 'email', 'first_name', 'last_name'],
    });
  }

  // ── Core: merge rules and resolve recipients ───────────────────────────── //

  /**
   * Resolves alert recipients for the given space + event.
   *
   * Returns:
   *  • null               — the space has NO rules at all →
   *                         caller MUST fall back to legacy hardcoded logic.
   *  • {sendEmail:false}  — the space HAS rules but none cover this event →
   *                         caller must suppress (no alert sent).
   *  • full ResolvedAlert — one or more rules matched → use rule-based delivery.
   */
  async resolveForEvent(
    spaceType: 'task' | 'ticket',
    spaceId: number,
    event: string,
    ctx: AlertResolverContext,
  ): Promise<ResolvedAlert | null> {
    // 1. Load ALL rules for this space (active + inactive) to decide
    //    whether the space has been configured with rules at all.
    const allRules = await this.entityManager.find(SpaceAlertRule, {
      where: { spaceType, spaceId },
    });

    // No rules defined for this space at all → signal caller to use legacy path.
    if (allRules.length === 0) {
      return null;
    }

    // 2. Filter active rules that listen for this specific event.
    // Defensive: TypeORM 'json' columns can return a raw string from the PG driver
    // in some versions — parse it to an array if needed.
    const parseEvents = (raw: unknown): string[] => {
      if (Array.isArray(raw)) return raw as string[];
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw) as unknown; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
          return Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const matching = allRules.filter(
      (r) => r.isActive && parseEvents(r.events).includes(event),
    );

    // Space has rules but none cover this event → suppress silently.
    // (Do NOT fall back to legacy — rules are the sole authority for this space.)
    if (matching.length === 0) {
      return {
        sendEmail: false,
        sendInApp: false,
        toEmails: [],
        ccEmails: [],
        notifUserIds: [],
        notifUserEmailMap: new Map<number, string>(),
      };
    }

    // 3. Resolve per-channel recipients
    const emailToSet = new Set<string>();
    const emailCcSet = new Set<string>();
    const inAppToUserMap = new Map<number, string>();
    const inAppCcUserMap = new Map<number, string>();

    // Pre-fetch all additional users to avoid N+1 queries
    const additionalUserIds = new Set<number>();
    for (const r of matching) {
      r.toAdditionalUserIds?.forEach((id) => {
        if (id != null) additionalUserIds.add(id);
      });
      r.ccAdditionalUserIds?.forEach((id) => {
        if (id != null) additionalUserIds.add(id);
      });
    }

    const additionalUsersMap = new Map<number, { id: number; email: string }>();
    if (additionalUserIds.size > 0) {
      const { In } = await import('typeorm');
      const users = await this.entityManager.find(User, {
        where: { id: In([...additionalUserIds]) },
        select: ['id', 'email'],
      });
      for (const u of users) {
        if (u.email && u.id != null) {
          additionalUsersMap.set(u.id, { id: u.id, email: u.email });
        }
      }
    }

    // Process each rule independently to keep channel scopes separate
    for (const r of matching) {
      const isEmail = r.channel === 'email' || r.channel === 'both';
      const isInApp = r.channel === 'in_app' || r.channel === 'both';

      const addTo = (email: string | null | undefined, userId: number | null | undefined) => {
        if (!email) return;
        if (isEmail) emailToSet.add(email);
        if (isInApp && userId) inAppToUserMap.set(userId, email);
      };

      const addCc = (email: string | null | undefined, userId: number | null | undefined) => {
        if (!email) return;
        if (isEmail && !emailToSet.has(email)) emailCcSet.add(email);
        if (isInApp && userId && !inAppToUserMap.has(userId)) inAppCcUserMap.set(userId, email);
      };

      if (r.toAssignee) addTo(ctx.assigneeEmail, ctx.assigneeUserId);
      if (r.toCoAssignees) {
        ctx.coAssigneeEmails.forEach((e, i) => addTo(e, ctx.coAssigneeUserIds[i]));
        ctx.memberEmails.forEach((e, i) => addTo(e, ctx.memberUserIds[i]));
      }
      if (r.toParticipants) {
        ctx.participantEmails.forEach((e, i) => addTo(e, ctx.participantUserIds[i]));
      }
      if (r.toCreator) addTo(ctx.createdByEmail, ctx.createdByUserId);
      if (r.toActor) addTo(ctx.actorEmail, ctx.actorUserId);

      r.toAdditionalUserIds?.forEach((uid) => {
        if (uid == null) return;
        const u = additionalUsersMap.get(uid);
        if (u) addTo(u.email, u.id);
      });

      if (r.ccAssignee) addCc(ctx.assigneeEmail, ctx.assigneeUserId);
      if (r.ccCoAssignees) {
        ctx.coAssigneeEmails.forEach((e, i) => addCc(e, ctx.coAssigneeUserIds[i]));
        ctx.memberEmails.forEach((e, i) => addCc(e, ctx.memberUserIds[i]));
      }
      if (r.ccParticipants) {
        ctx.participantEmails.forEach((e, i) => addCc(e, ctx.participantUserIds[i]));
      }
      if (r.ccCreator) addCc(ctx.createdByEmail, ctx.createdByUserId);
      if (r.ccActor) addCc(ctx.actorEmail, ctx.actorUserId);

      r.ccAdditionalUserIds?.forEach((uid) => {
        if (uid == null) return;
        const u = additionalUsersMap.get(uid);
        if (u) addCc(u.email, u.id);
      });
    }

    // 4. Fallback: if absolutely no one is receiving anything, send in-app to actor
    if (emailToSet.size === 0 && inAppToUserMap.size === 0 && ctx.actorEmail) {
      if (ctx.actorUserId) inAppToUserMap.set(ctx.actorUserId, ctx.actorEmail);
    }

    const notifUserEmailMap = new Map<number, string>([
      ...inAppToUserMap,
      ...inAppCcUserMap,
    ]);

    const sendEmail = emailToSet.size > 0;
    const sendInApp = notifUserEmailMap.size > 0;

    return {
      sendEmail,
      sendInApp,
      toEmails: [...emailToSet],
      ccEmails: [...emailCcSet],
      notifUserIds: [...notifUserEmailMap.keys()],
      notifUserEmailMap,
    };
  }
}
