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

    // 3. Merge channels (union)
    const sendEmail = matching.some(
      (r) => r.channel === 'email' || r.channel === 'both',
    );
    const sendInApp = matching.some(
      (r) => r.channel === 'in_app' || r.channel === 'both',
    );

    // 4. Merge TO flags (union across all matching rules)
    const toFlags = {
      assignee: matching.some((r) => r.toAssignee),
      coAssignees: matching.some((r) => r.toCoAssignees),
      participants: matching.some((r) => r.toParticipants),
      creator: matching.some((r) => r.toCreator),
      actor: matching.some((r) => r.toActor),
      additionalIds: [
        ...new Set(matching.flatMap((r) => r.toAdditionalUserIds ?? [])),
      ],
    };

    // 5. Merge CC flags
    const ccFlags = {
      assignee: matching.some((r) => r.ccAssignee),
      coAssignees: matching.some((r) => r.ccCoAssignees),
      participants: matching.some((r) => r.ccParticipants),
      creator: matching.some((r) => r.ccCreator),
      actor: matching.some((r) => r.ccActor),
      additionalIds: [
        ...new Set(matching.flatMap((r) => r.ccAdditionalUserIds ?? [])),
      ],
    };

    // 6. Resolve flags → email sets + userId maps
    const toEmailSet = new Set<string>();
    const toUserMap = new Map<number, string>(); // userId → email

    const addTo = (
      email: string | null | undefined,
      userId: number | null | undefined,
    ) => {
      if (email) {
        toEmailSet.add(email);
        if (userId) toUserMap.set(userId, email);
      }
    };

    if (toFlags.assignee) addTo(ctx.assigneeEmail, ctx.assigneeUserId);
    if (toFlags.coAssignees) {
      ctx.coAssigneeEmails.forEach((e, i) =>
        addTo(e, ctx.coAssigneeUserIds[i]),
      );
      ctx.memberEmails.forEach((e, i) => addTo(e, ctx.memberUserIds[i]));
    }
    if (toFlags.participants) {
      ctx.participantEmails.forEach((e, i) =>
        addTo(e, ctx.participantUserIds[i]),
      );
    }
    if (toFlags.creator) addTo(ctx.createdByEmail, ctx.createdByUserId);
    if (toFlags.actor) addTo(ctx.actorEmail, ctx.actorUserId);

    for (const uid of toFlags.additionalIds) {
      const user = await this.entityManager.findOne(User, {
        where: { id: uid },
        select: ['id', 'email'],
      });
      if (user?.email) addTo(user.email, user.id);
    }

    // 7. Build CC set (exclude anything already in TO)
    const ccEmailSet = new Set<string>();
    const ccUserMap = new Map<number, string>();

    const addCc = (
      email: string | null | undefined,
      userId: number | null | undefined,
    ) => {
      if (email && !toEmailSet.has(email)) {
        ccEmailSet.add(email);
        if (userId) ccUserMap.set(userId, email);
      }
    };

    if (ccFlags.assignee) addCc(ctx.assigneeEmail, ctx.assigneeUserId);
    if (ccFlags.coAssignees) {
      ctx.coAssigneeEmails.forEach((e, i) =>
        addCc(e, ctx.coAssigneeUserIds[i]),
      );
      ctx.memberEmails.forEach((e, i) => addCc(e, ctx.memberUserIds[i]));
    }
    if (ccFlags.participants) {
      ctx.participantEmails.forEach((e, i) =>
        addCc(e, ctx.participantUserIds[i]),
      );
    }
    if (ccFlags.creator) addCc(ctx.createdByEmail, ctx.createdByUserId);
    if (ccFlags.actor) addCc(ctx.actorEmail, ctx.actorUserId);

    for (const uid of ccFlags.additionalIds) {
      const user = await this.entityManager.findOne(User, {
        where: { id: uid },
        select: ['id', 'email'],
      });
      if (user?.email) addCc(user.email, user.id);
    }

    // 8. Fallback: TO must never be empty
    if (toEmailSet.size === 0 && ctx.actorEmail) {
      toEmailSet.add(ctx.actorEmail);
      if (ctx.actorUserId) toUserMap.set(ctx.actorUserId, ctx.actorEmail);
    }

    // 9. Build unified notif user map (TO ∪ CC)
    const notifUserEmailMap = new Map<number, string>([
      ...toUserMap,
      ...ccUserMap,
    ]);

    return {
      sendEmail,
      sendInApp,
      toEmails: [...toEmailSet],
      ccEmails: [...ccEmailSet],
      notifUserIds: [...notifUserEmailMap.keys()],
      notifUserEmailMap,
    };
  }
}
