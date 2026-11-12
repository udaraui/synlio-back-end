import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Ticket } from '../../ticket-management/ticket/ticket.entity';
import { TicketService } from '../../ticket-management/ticket/ticket.service';
import { StatusBaseEnum } from '../../common/enum/status-base.enum';

export function resolveSpaceStatus(
  statuses: Array<{ id?: number | string; name?: string; color?: string; base?: StatusBaseEnum; isPrimaryBase?: boolean }>,
  requestedStatus: string,
): { id: number; name: string; color: string } | null {
  if (!requestedStatus || !statuses || statuses.length === 0) return null;
  const q = String(requestedStatus).trim().toLowerCase();

  // Tier 1: Exact Name Match
  const exact = statuses.find((s) => s.name?.trim().toLowerCase() === q);
  if (exact && exact.id !== undefined) return { id: Number(exact.id), name: exact.name || '', color: exact.color || '#6366f1' };

  // Tier 1b: Substring Match
  const sub = statuses.find(
    (s) => s.name && (s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())),
  );
  if (sub && sub.id !== undefined) return { id: Number(sub.id), name: sub.name || '', color: sub.color || '#6366f1' };

  // Tier 2: Status Base Semantic Mapping
  let targetBase: StatusBaseEnum | null = null;
  if (/^(done|complete|completed|finish|finished|resolved|resolve|closed|close)$/i.test(q)) {
    targetBase = StatusBaseEnum.FINISHED;
  } else if (/^(in\s*progress|inprogress|processing|in\s*review|inreview|ongoing|underway)$/i.test(q)) {
    targetBase = StatusBaseEnum.PROCESSING;
  } else if (/^(to\s*do|todo|to\s*start|tostart|open|new|backlog|reopen)$/i.test(q)) {
    targetBase = StatusBaseEnum.TOSTART;
  }

  if (targetBase) {
    const baseMatches = statuses.filter((s) => s.base === targetBase);
    if (baseMatches.length > 0) {
      const semanticMatch = baseMatches.find(
        (s) => s.name && (s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())),
      );
      const primary = baseMatches.find((s) => s.isPrimaryBase);
      const chosen = semanticMatch || primary || baseMatches[0];
      if (chosen && chosen.id !== undefined) {
        return { id: Number(chosen.id), name: chosen.name || '', color: chosen.color || '#6366f1' };
      }
    }
  }

  return null;
}

/**
 * Fuzzy severity resolver with semantic tier mapping.
 * Maps common severity terms to the closest available option in the space's severity config.
 * Tier ordering (highest to lowest): Blocker → Critical → High → Medium → Low
 * When exact/substring match fails, falls back to semantic tier proximity:
 *   e.g. user says "critical" but space only has [Blocker, High, Medium, Low]
 *        → returns "Blocker" (closest highest-tier match).
 */
function resolveSeverityFuzzy(
  rows: Array<{ id: number; name: string }>,
  requested: string,
): { id: number; name: string } | null {
  if (!rows || rows.length === 0 || !requested) return null;
  const q = String(requested).trim().toLowerCase();

  // Tier 1: Exact match
  const exact = rows.find((s) => s.name.toLowerCase() === q);
  if (exact) return exact;

  // Tier 2: Substring match (bidirectional)
  const sub = rows.find(
    (s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()),
  );
  if (sub) return sub;

  // Tier 3: Semantic tier mapping — severity level equivalences
  // Map the requested term to a tier index: blocker=0, critical=1, high=2, medium=3, low=4
  const TIER_MAP: Record<string, number> = {
    blocker: 0, blocking: 0, urgent: 0,
    critical: 1,
    high: 2, major: 2,
    medium: 3, moderate: 3, normal: 3,
    low: 4, minor: 4, trivial: 4,
  };
  const requestedTier = TIER_MAP[q] ?? null;
  if (requestedTier === null) return null;

  // Assign tiers to available rows
  const rowsWithTier = rows.map((s) => ({
    ...s,
    tier: TIER_MAP[s.name.toLowerCase()] ?? 99,
  }));
  // Sort by absolute distance from the requested tier
  rowsWithTier.sort((a, b) => Math.abs(a.tier - requestedTier) - Math.abs(b.tier - requestedTier));
  if (rowsWithTier.length > 0 && rowsWithTier[0].tier !== 99) {
    return { id: rowsWithTier[0].id, name: rowsWithTier[0].name };
  }

  return null;
}

export interface TicketMutationResult {
  status: 'UPDATED' | 'FAILED';
  success: boolean;
  tickets: any[];
  error?: string;
  warnings: string[];
  summary: string;
}

function formatUnrecognizedNotice(
  unrecognized: Array<{ field: string; label: string; value: string; spaceName: string }>,
): string[] {
  if (!unrecognized || unrecognized.length === 0) return [];

  const bySpace = new Map<string, Array<{ field: string; label: string; value: string }>>();
  for (const item of unrecognized) {
    const list = bySpace.get(item.spaceName) || [];
    if (!list.some((existing) => existing.field === item.field && existing.value.toLowerCase() === item.value.toLowerCase())) {
      list.push(item);
    }
    bySpace.set(item.spaceName, list);
  }

  const result: string[] = [];
  for (const [spaceName, items] of bySpace.entries()) {
    if (items.length === 1) {
      const item = items[0];
      const fieldCap = item.label.charAt(0).toUpperCase() + item.label.slice(1);
      const line1 = `${fieldCap} "${item.value}" was not recognized in space "${spaceName}".`;
      const line2 = `${fieldCap} is fallback to defaults.`;
      result.push(`${line1}\n${line2}`);
    } else {
      const parts = items.map((item, idx) => {
        const fieldName = idx === 0 ? (item.label.charAt(0).toUpperCase() + item.label.slice(1)) : item.label.toLowerCase();
        return `${fieldName} "${item.value}"`;
      });

      let joinedFields = '';
      if (parts.length === 2) {
        joinedFields = `${parts[0]} and ${parts[1]}`;
      } else {
        joinedFields = `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
      }

      const fieldNames = items.map((item, idx) => {
        return idx === 0 ? (item.label.charAt(0).toUpperCase() + item.label.slice(1)) : item.label.toLowerCase();
      });
      let joinedNames = '';
      if (fieldNames.length === 2) {
        joinedNames = `${fieldNames[0]} and ${fieldNames[1]}`;
      } else {
        joinedNames = `${fieldNames.slice(0, -1).join(', ')} and ${fieldNames[fieldNames.length - 1]}`;
      }

      const line1 = `${joinedFields} was not recognized in space "${spaceName}".`;
      const line2 = `${joinedNames} are fallback to defaults.`;
      result.push(`${line1}\n${line2}`);
    }
  }

  return result;
}

@Injectable()
export class TicketMutationExecutorService {
  private readonly logger = new Logger(TicketMutationExecutorService.name);

  constructor(
    private readonly entityManager: EntityManager,
    private readonly ticketService: TicketService,
  ) {}

  /**
   * Executes conversational ticket mutations drafted by the AI engine.
   * Enforces Privilege 104 (Update Ticket) and Space Membership checks,
   * then delegates to the dedicated patch methods in TicketService
   * (identical to the inline editable components on the frontend).
   */
  async executeTicketMutation(
    mutationPayload: {
      action?: string;
      entityType?: string;
      targets: string[];
      changes: Record<string, any>;
      summary?: string;
      tickets?: any[];
    },
    companyId: number,
    allowedTicketSpaceIds: number[],
    authUser: any,
  ): Promise<TicketMutationResult> {
    const warnings: string[] = [];

    // 1. Enforce Privilege 104 (Update Ticket)
    const userPrivs = authUser?.privileges || [];
    const companyPriv = userPrivs.find(
      (p: any) => Number(p.companyId) === Number(companyId),
    );
    const privilegeIds: number[] = companyPriv?.privilegeIds || [];
    const hasUpdatePrivilege =
      privilegeIds.includes(104) || privilegeIds.length === 0 || !authUser?.privileges;

    if (!hasUpdatePrivilege) {
      const errorMsg =
        'You do not have permission to update tickets in this workspace (Privilege 104 required).';
      return {
        status: 'FAILED',
        success: false,
        tickets: [],
        error: errorMsg,
        warnings: [],
        summary: errorMsg,
      };
    }

    // 2. Validate Target Tickets
    const targets = mutationPayload.targets || [];
    if (targets.length === 0) {
      const errorMsg =
        'Please specify which ticket code you would like to update (e.g. PTS-12).';
      return {
        status: 'FAILED',
        success: false,
        tickets: [],
        error: errorMsg,
        warnings: [],
        summary: errorMsg,
      };
    }

    const changes = mutationPayload.changes || {};

    // Execute each ticket mutation concurrently with Promise.all
    // Within each ticket, field patches execute sequentially to preserve database integrity
    const ticketPromises = targets.map(async (targetCode) => {
      const codeClean = String(targetCode).trim();
      if (!codeClean) return null;

      const ticketDraftItem = Array.isArray(mutationPayload.tickets)
        ? mutationPayload.tickets.find((t: any) => String(t.code || '').trim().toUpperCase() === codeClean.toUpperCase())
        : null;

      const itemChanges = {
        ...changes,
        ...(ticketDraftItem || {}),
      };

      // 3. Locate Ticket in Database
      const ticket = await this.entityManager
        .createQueryBuilder(Ticket, 'ticket')
        .leftJoinAndSelect('ticket.ticketSpace', 'space')
        .where('ticket.companyId = :companyId', { companyId })
        .andWhere('UPPER(ticket.code) = UPPER(:code)', { code: codeClean })
        .getOne();

      if (!ticket) {
        warnings.push(`Ticket "${codeClean}" was not found in this company.`);
        return null;
      }

      // 4. Validate Ticket Space Membership
      const spaceId = Number(ticket.ticketSpaceId);
      if (!allowedTicketSpaceIds.includes(spaceId)) {
        const spaceName = ticket.ticketSpace?.name || 'this space';
        warnings.push(`Cannot update ticket ${ticket.code}: You are not a member of the '${spaceName}' space.`);
        return null;
      }

      const ticketId = Number(ticket.id);
      const spaceName = ticket.ticketSpace?.name || 'Ticket Space';

      try {
        // (a) Status Patch via dedicated patchTicketStatus
        const requestedStatus = itemChanges.status || itemChanges.statusName || (itemChanges.statusId ? String(itemChanges.statusId) : null);
        if (requestedStatus) {
          const statusRows: Array<{ id: number; name: string; color?: string; base?: StatusBaseEnum; isPrimaryBase?: boolean }> =
            await this.entityManager.query(
              `SELECT "id", "name", "color", "base", "isPrimaryBase" FROM ticket_space_status_config WHERE "ticketSpaceId" = $1`,
              [spaceId],
            );
          const matched =
            (itemChanges.statusId ? statusRows.find((s) => Number(s.id) === Number(itemChanges.statusId)) : null) ||
            resolveSpaceStatus(statusRows, requestedStatus);

          if (matched) {
            await this.ticketService.patchTicketStatus(
              ticketId,
              Number(matched.id),
              ticket.statusId ?? null,
              authUser,
              companyId,
            );
          } else {
            warnings.push(
              `Status "${requestedStatus}" was not recognized in space "${spaceName}".`,
            );
          }
        }

        // (b) Severity Patch via dedicated patchTicketSeverity
        const requestedSeverity = itemChanges.severity || itemChanges.severityName || (itemChanges.severityId ? String(itemChanges.severityId) : null);
        if (requestedSeverity) {
          const sevRows: Array<{ id: number; name: string }> =
            await this.entityManager.query(
              `SELECT "id", "name" FROM ticket_space_severity_config WHERE "ticketSpaceId" = $1`,
              [spaceId],
            );
          // Use semantic fuzzy resolver so "critical" maps to "Blocker" when Critical doesn't exist
          const matched = resolveSeverityFuzzy(sevRows, requestedSeverity);

          if (matched) {
            await this.ticketService.patchTicketSeverity(
              ticketId,
              Number(matched.id),
              ticket.severityId ?? null,
              authUser,
              companyId,
            );
          } else {
            warnings.push(
              `Severity "${requestedSeverity}" was not recognized in space "${spaceName}".`,
            );
          }
        }

        // (c) Ticket Type Patch via dedicated patchTicketType
        const requestedType = changes.ticketType || changes.type || changes.ticketTypeName;
        if (requestedType) {
          const typeRows: Array<{ id: number; name: string }> =
            await this.entityManager.query(
              `SELECT "id", "name" FROM ticket_space_type_config WHERE "ticketSpaceId" = $1`,
              [spaceId],
            );
          const targetType = String(requestedType).trim().toLowerCase();
          const matched =
            typeRows.find((t) => t.name.toLowerCase() === targetType) ||
            typeRows.find(
              (t) =>
                t.name.toLowerCase().includes(targetType) ||
                targetType.includes(t.name.toLowerCase()),
            );

          if (matched) {
            await this.ticketService.patchTicketType(
              ticketId,
              Number(matched.id),
              authUser,
              companyId,
            );
          } else {
            warnings.push(
              `Ticket type "${requestedType}" was not recognized in space "${spaceName}".`,
            );
          }
        }

        // (d) Queue Patch via dedicated patchTicketQueue
        const requestedQueue = itemChanges.queue || itemChanges.queueName || (itemChanges.queueId ? String(itemChanges.queueId) : null);
        if (requestedQueue) {
          const queueRows: Array<{ id: number; name: string }> =
            await this.entityManager.query(
              `SELECT "id", "name" FROM ticket_queue WHERE "ticketSpaceId" = $1`,
              [spaceId],
            );
          const targetQueue = String(requestedQueue).trim().toLowerCase();
          const matched =
            queueRows.find((q) => q.name.toLowerCase() === targetQueue) ||
            queueRows.find(
              (q) =>
                q.name.toLowerCase().includes(targetQueue) ||
                targetQueue.includes(q.name.toLowerCase()),
            );

          if (matched) {
            await this.ticketService.patchTicketQueue(
              ticketId,
              Number(matched.id),
              authUser,
              companyId,
            );
          } else {
            warnings.push(
              `Queue "${requestedQueue}" was not recognized in space "${spaceName}".`,
            );
          }
        }

        // (e) Assignee Patch via dedicated patchTicketAssignee
        const requestedAssignee = itemChanges.assignee || itemChanges.assigneeName || (itemChanges.assigneeId ? String(itemChanges.assigneeId) : null);
        if (requestedAssignee) {
          const targetUser = String(requestedAssignee).trim().toLowerCase();
          const members: Array<{
            id: number;
            userId: number;
            userFirstName: string;
            userLastName: string;
            userEmail: string;
          }> = await this.entityManager.query(
            `SELECT m."id", m."userId",
                    COALESCE(NULLIF(TRIM(m."userFirstName"), ''), TRIM(u.first_name), '') AS "userFirstName",
                    COALESCE(NULLIF(TRIM(m."userLastName"), ''), TRIM(u.last_name), '') AS "userLastName",
                    COALESCE(NULLIF(TRIM(m."userEmail"), ''), TRIM(u.email), '') AS "userEmail"
             FROM ticket_space_member m
             LEFT JOIN "user" u ON u.id = m."userId"
             WHERE m."ticketSpaceId" = $1`,
            [spaceId],
          );

          let matchedMember: any = null;
          if (itemChanges.assigneeId && Number(itemChanges.assigneeId) > 0) {
            matchedMember = members.find((m) => Number(m.id) === Number(itemChanges.assigneeId) || Number(m.userId) === Number(itemChanges.assigneeId));
          } else if (
            targetUser === 'me' ||
            targetUser === 'myself' ||
            targetUser === 'i' ||
            targetUser === 'self'
          ) {
            const userEmail = (
              authUser?.email ||
              authUser?.userEmail ||
              ''
            )
              .trim()
              .toLowerCase();
            const userId = Number(authUser?.userId || authUser?.id || 0);

            matchedMember = members.find(
              (m) =>
                (userEmail && m.userEmail.toLowerCase() === userEmail) ||
                (userId > 0 && Number(m.userId) === userId),
            );
          } else {
            const normalizedTarget = targetUser.replace(/\s+/g, ' ').trim();
            let matchedList = members.filter((m) => {
              const full = `${m.userFirstName} ${m.userLastName}`
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();
              const email = (m.userEmail || '').toLowerCase().trim();
              const emailPrefix = email.split('@')[0];
              return (
                full === normalizedTarget ||
                email === normalizedTarget ||
                emailPrefix === normalizedTarget
              );
            });

            if (matchedList.length === 0) {
              matchedList = members.filter((m) => {
                const full = `${m.userFirstName} ${m.userLastName}`
                  .toLowerCase()
                  .replace(/\s+/g, ' ')
                  .trim();
                const first = (m.userFirstName || '').toLowerCase().trim();
                const last = (m.userLastName || '').toLowerCase().trim();
                const email = (m.userEmail || '').toLowerCase().trim();
                return (
                  full.includes(normalizedTarget) ||
                  normalizedTarget.includes(full) ||
                  (first && normalizedTarget === first) ||
                  (last && normalizedTarget === last) ||
                  (first && normalizedTarget.includes(first)) ||
                  (last && normalizedTarget.includes(last)) ||
                  email.includes(normalizedTarget)
                );
              });
            }

            if (matchedList.length >= 1) {
              matchedMember = matchedList[0];
            }
          }

          if (matchedMember) {
            await this.ticketService.patchTicketAssignee(
              ticketId,
              Number(matchedMember.id),
              ticket.assigneeId ?? null,
              authUser,
              companyId,
            );
          } else {
            warnings.push(
              `No team member matching "${requestedAssignee}" was found in '${spaceName}'.`,
            );
          }
        }

        // (f) Title / Name Patch via dedicated patchTicketName
        if (itemChanges.title || itemChanges.name) {
          const newName = String(itemChanges.title || itemChanges.name).trim();
          if (newName) {
            await this.ticketService.patchTicketName(
              ticketId,
              newName,
              ticket.name ?? null,
              authUser,
              companyId,
            );
          }
        }

        // (g) Description Patch via dedicated patchTicketDescription
        if (itemChanges.description !== undefined && itemChanges.description !== null) {
          const newDesc = String(itemChanges.description).trim();
          await this.ticketService.patchTicketDescription(
            ticketId,
            newDesc,
            authUser,
            companyId,
          );
        }

        // (h) Effort Patch via dedicated patchTicketEffort
        if (itemChanges.effort !== undefined && itemChanges.effort !== null && itemChanges.effort !== '' || itemChanges.plannedEffort !== undefined) {
          const effortNum = Number(itemChanges.effort !== undefined ? itemChanges.effort : itemChanges.plannedEffort);
          if (!isNaN(effortNum)) {
            await this.ticketService.patchTicketEffort(
              ticketId,
              effortNum,
              null,
              authUser,
              companyId,
            );
          }
        }

        // (i) Completion Date Patch via dedicated patchTicketCompletionDate
        if (itemChanges.completionDate || itemChanges.dueDate) {
          const dateVal = new Date(itemChanges.completionDate || itemChanges.dueDate);
          if (!isNaN(dateVal.getTime())) {
            const dateStr = dateVal.toISOString().split('T')[0];
            await this.ticketService.patchTicketCompletionDate(
              ticketId,
              dateStr,
              authUser,
              companyId,
            );
          }
        }

        // 6. Load fully enriched Ticket DTO for frontend
        const fullTicket = await this.ticketService.findOne(ticketId, companyId);
        return fullTicket;
      } catch (err: any) {
        this.logger.error(`Error patching ticket ${ticket.code}: ${err.message}`, err.stack);
        warnings.push(`Could not update some fields of ${ticket.code}: ${err.message}`);
        return null;
      }
    });

    const results = await Promise.all(ticketPromises);
    const updatedTickets = results.filter((t): t is NonNullable<typeof t> => Boolean(t));

    if (updatedTickets.length === 0) {
      const errorMsg = warnings.length > 0
        ? warnings.join(' ')
        : 'Failed to update the ticket.';
      return {
        status: 'FAILED',
        success: false,
        tickets: [],
        error: errorMsg,
        warnings,
        summary: errorMsg,
      };
    }

    const summary =
      mutationPayload.summary ||
      `I've updated **${updatedTickets.map((t) => t.code).join(', ')}**.`;

    return {
      status: 'UPDATED',
      success: true,
      tickets: updatedTickets,
      warnings,
      summary,
    };
  }

  /**
   * Resolves candidate tickets matching filter criteria (e.g. assignee, space)
   * when no explicit ticket codes were mentioned by the user.
   * Generates clickable badge options:
   * 1. [All (N tickets)]
   * 2. First 4-5 tickets individually
   */
  /**
   * Prepares ticket mutation drafts without applying changes to the database.
   * Returns a ready draft payload with resolved space configs and member IDs,
   * allowing the user to review and confirm the update from the UI.
   */
  async prepareTicketMutationDraft(
    mutationPayload: {
      action?: string;
      entityType?: string;
      targets: string[];
      changes: Record<string, any>;
      summary?: string;
      tickets?: any[];
    },
    companyId: number,
    allowedTicketSpaceIds: number[],
    authUser: any,
  ): Promise<any> {
    const targets = mutationPayload.targets || [];
    const changes = mutationPayload.changes || {};
    const warnings: string[] = [];

    const draftPromises = targets.map(async (targetCode) => {
      let codeClean = String(targetCode).trim();
      if (codeClean.includes(':')) {
        codeClean = codeClean.split(':')[0].trim();
      }
      if (!codeClean) return null;

      const ticket = await this.entityManager
        .createQueryBuilder(Ticket, 'ticket')
        .leftJoinAndSelect('ticket.ticketSpace', 'space')
        .leftJoinAndSelect('ticket.status', 'status')
        .leftJoinAndSelect('ticket.severity', 'severity')
        .leftJoinAndSelect('ticket.ticketType', 'ticketType')
        .leftJoinAndSelect('ticket.queue', 'queue')
        .leftJoinAndSelect('ticket.assignee', 'assignee')
        .where('ticket.companyId = :companyId', { companyId })
        .andWhere('(UPPER(ticket.code) = UPPER(:code) OR LOWER(ticket.name) = LOWER(:name))', {
          code: codeClean,
          name: String(targetCode).trim().toLowerCase(),
        })
        .getOne();

      if (!ticket) {
        warnings.push(`Ticket "${codeClean}" was not found.`);
        return null;
      }

      const spaceId = Number(ticket.ticketSpaceId);
      const spaceName = ticket.ticketSpace?.name || 'Ticket Space';

      const unrecognizedInDraft: Array<{ field: string; label: string; value: string; spaceName: string }> = [];
      const recognizedInDraft: Array<{ field: string; label: string; value: string }> = [];

      // 1. Resolve Status
      let resolvedStatusId = ticket.statusId;
      let resolvedStatusName = ticket.status?.name || ticket.statusName;
      const requestedStatus = changes.status || changes.statusName;
      if (requestedStatus) {
        const statusRows: Array<{ id: number; name: string; color?: string; base?: StatusBaseEnum; isPrimaryBase?: boolean }> = await this.entityManager.query(
          `SELECT "id", "name", "color", "base", "isPrimaryBase" FROM ticket_space_status_config WHERE "ticketSpaceId" = $1`,
          [spaceId],
        );
        const matched = resolveSpaceStatus(statusRows, requestedStatus);
        if (matched) {
          resolvedStatusId = matched.id;
          resolvedStatusName = matched.name;
          recognizedInDraft.push({ field: 'status', label: 'status', value: matched.name });
        } else {
          unrecognizedInDraft.push({ field: 'status', label: 'Status', value: String(requestedStatus), spaceName });
        }
      }

      // 2. Resolve Severity
      let resolvedSeverityId = ticket.severityId;
      let resolvedSeverityName = ticket.severity?.name || ticket.severityName;
      const requestedSeverity = changes.severity || changes.severityName;
      if (requestedSeverity) {
        const severityRows: Array<{ id: number; name: string }> = await this.entityManager.query(
          `SELECT "id", "name" FROM ticket_space_severity_config WHERE "ticketSpaceId" = $1`,
          [spaceId],
        );
        const matched = resolveSeverityFuzzy(severityRows, requestedSeverity);
        if (matched) {
          resolvedSeverityId = matched.id;
          resolvedSeverityName = matched.name;
          recognizedInDraft.push({ field: 'severity', label: 'severity', value: matched.name });
        } else {
          unrecognizedInDraft.push({ field: 'severity', label: 'severity', value: String(requestedSeverity), spaceName });
        }
      }

      // 3. Resolve Queue
      let resolvedQueueId = ticket.queueId;
      let resolvedQueueName = ticket.queue?.name || ticket.queueName;
      const requestedQueue = changes.queue || changes.queueName;
      if (requestedQueue) {
        const queueRows: Array<{ id: number; name: string }> = await this.entityManager.query(
          `SELECT "id", "name" FROM ticket_queue WHERE "ticketSpaceId" = $1`,
          [spaceId],
        );
        const targetQueue = String(requestedQueue).trim().toLowerCase();
        const matched =
          queueRows.find((q) => q.name.toLowerCase() === targetQueue) ||
          queueRows.find(
            (q) =>
              q.name.toLowerCase().includes(targetQueue) ||
              targetQueue.includes(q.name.toLowerCase()),
          );
        if (matched) {
          resolvedQueueId = matched.id;
          resolvedQueueName = matched.name;
          recognizedInDraft.push({ field: 'queue', label: 'queue', value: matched.name });
        } else {
          unrecognizedInDraft.push({ field: 'queue', label: 'queue', value: String(requestedQueue), spaceName });
        }
      }

      // 4. Resolve Assignee
      let resolvedAssigneeId = ticket.assigneeId;
      let resolvedAssigneeName = ticket.assigneeName;
      const requestedAssignee = changes.assignee || changes.assigneeName;
      if (requestedAssignee) {
        const targetUser = String(requestedAssignee).trim().toLowerCase();
        const members: Array<{
          id: number;
          userId: number;
          userFirstName: string;
          userLastName: string;
          userEmail: string;
        }> = await this.entityManager.query(
          `SELECT m."id", m."userId",
                  COALESCE(NULLIF(TRIM(m."userFirstName"), ''), TRIM(u.first_name), '') AS "userFirstName",
                  COALESCE(NULLIF(TRIM(m."userLastName"), ''), TRIM(u.last_name), '') AS "userLastName",
                  COALESCE(NULLIF(TRIM(m."userEmail"), ''), TRIM(u.email), '') AS "userEmail"
           FROM ticket_space_member m
           LEFT JOIN "user" u ON u.id = m."userId"
           WHERE m."ticketSpaceId" = $1`,
          [spaceId],
        );

        let matchedMember: any = null;
        if (['me', 'myself', 'i', 'self'].includes(targetUser)) {
          const userEmail = (authUser?.email || authUser?.userEmail || '').trim().toLowerCase();
          const userId = Number(authUser?.userId || authUser?.id || 0);
          matchedMember = members.find(
            (m) =>
              (userEmail && m.userEmail.toLowerCase() === userEmail) ||
              (userId > 0 && Number(m.userId) === userId),
          );
        } else {
          const normalizedTarget = targetUser.replace(/\s+/g, ' ').trim();
          matchedMember = members.find((m) => {
            const full = `${m.userFirstName} ${m.userLastName}`.toLowerCase().replace(/\s+/g, ' ').trim();
            const email = (m.userEmail || '').toLowerCase().trim();
            return full === normalizedTarget || email === normalizedTarget || email.startsWith(normalizedTarget);
          });
        }

        if (matchedMember) {
          resolvedAssigneeId = Number(matchedMember.id);
          resolvedAssigneeName = `${matchedMember.userFirstName} ${matchedMember.userLastName}`.trim();
          recognizedInDraft.push({ field: 'assignee', label: 'assignee', value: resolvedAssigneeName });
        } else {
          unrecognizedInDraft.push({ field: 'assignee', label: 'assignee', value: String(requestedAssignee), spaceName });
        }
      }

      // 5. Resolve Type
      let resolvedTypeId = ticket.ticketTypeId;
      let resolvedTypeName = ticket.ticketType?.name || ticket.ticketTypeName;
      const requestedType = changes.ticketType || changes.ticketTypeName || changes.type;
      if (requestedType) {
        const typeRows: Array<{ id: number; name: string }> = await this.entityManager.query(
          `SELECT "id", "name" FROM ticket_space_type_config WHERE "ticketSpaceId" = $1`,
          [spaceId],
        );
        const targetType = String(requestedType).trim().toLowerCase();
        const matched =
          typeRows.find((t) => t.name.toLowerCase() === targetType) ||
          typeRows.find(
            (t) =>
              t.name.toLowerCase().includes(targetType) ||
              targetType.includes(t.name.toLowerCase()),
          );
        if (matched) {
          resolvedTypeId = matched.id;
          resolvedTypeName = matched.name;
          recognizedInDraft.push({ field: 'type', label: 'ticket type', value: matched.name });
        } else {
          unrecognizedInDraft.push({ field: 'type', label: 'ticket type', value: String(requestedType), spaceName });
        }
      }

      // Check for content/date changes
      if (changes.title || changes.name) {
        recognizedInDraft.push({ field: 'title', label: 'title', value: String(changes.title || changes.name) });
      }
      if (changes.description !== undefined) {
        recognizedInDraft.push({ field: 'description', label: 'description', value: String(changes.description) });
      }
      if (changes.completionDate || changes.dueDate) {
        recognizedInDraft.push({ field: 'completionDate', label: 'due date', value: String(changes.completionDate || changes.dueDate) });
      }
      if (changes.effort !== undefined) {
        recognizedInDraft.push({ field: 'plannedEffort', label: 'effort', value: String(changes.effort) });
      }

      const draftItem = {
        id: ticket.id,
        code: ticket.code,
        name: String(changes.title || changes.name || ticket.name).trim(),
        description: changes.description !== undefined ? String(changes.description) : (ticket.description || ''),
        ticketSpaceId: ticket.ticketSpaceId,
        ticketSpaceName: spaceName,
        statusId: resolvedStatusId,
        statusName: resolvedStatusName,
        severityId: resolvedSeverityId,
        severityName: resolvedSeverityName,
        assigneeId: resolvedAssigneeId,
        assigneeName: resolvedAssigneeName,
        ticketTypeId: resolvedTypeId,
        ticketTypeName: resolvedTypeName,
        queueId: resolvedQueueId || ticket.queueId,
        queueName: resolvedQueueName || ticket.queue?.name || 'Default',
        completionDate: changes.completionDate || changes.dueDate || ticket.completionDate,
        plannedEffort: changes.effort !== undefined ? Number(changes.effort) : ticket.plannedEffort,
        isUpdate: true,
      };

      return {
        draftItem,
        unrecognizedInDraft,
        recognizedInDraft,
      };
    });

    const results = await Promise.all(draftPromises);
    const validResults = results.filter((r): r is NonNullable<typeof r> => Boolean(r));
    const drafts = validResults.map((r) => r.draftItem);

    const allUnrecognized = validResults.flatMap((r) => r.unrecognizedInDraft);
    const allRecognized = validResults.flatMap((r) => r.recognizedInDraft);

    const formattedNotices = formatUnrecognizedNotice(allUnrecognized);
    warnings.push(...formattedNotices);

    const isAllUnrecognized = allUnrecognized.length > 0 && allRecognized.length === 0;

    let summary = '';
    if (drafts.length > 0) {
      summary = `I've prepared the updates for **${drafts.map((d) => d.code).join(', ')}**. Please review and confirm below.`;
    } else if (targets.length > 0) {
      const notFoundList = targets.map((t) => `**${t}**`).join(', ');
      summary = targets.length === 1
        ? `I couldn't find ticket ${notFoundList} in this space. Please double-check the ticket code and try again.`
        : `None of the requested tickets (${notFoundList}) could be found in this space. Please double-check the ticket codes and try again.`;
    } else {
      summary = mutationPayload.summary || 'Which ticket would you like to update? Please provide the ticket code (e.g. PTS-12).';
    }

    return {
      action: 'UPDATE_TICKET',
      status: drafts.length > 0 ? 'READY' : 'NOT_FOUND',
      summary,
      draft: drafts[0] || null,
      drafts,
      tickets: drafts,
      targets,
      changes,
      warnings,
      allUnrecognized: isAllUnrecognized,
      needs: [],
    };
  }

  async findCandidateTickets(
    mutationPayload: any,
    companyId: number,
    allowedTicketSpaceIds: number[],
    authUser: any,
    requestedSpaceId?: number,
  ): Promise<{
    summary: string;
    options: Array<{ id: number; name: string; label: string; actionText: string }>;
    candidateTickets: Array<{ id: number; code: string; name: string }>;
  }> {
    const filter = mutationPayload.filter || {};
    const changes = mutationPayload.changes || {};
    const targetStatus = changes.status || changes.statusName || 'In Progress';

    // 1. Determine Space
    const spaceId = Number(requestedSpaceId || (allowedTicketSpaceIds && allowedTicketSpaceIds[0]) || 0);
    if (!spaceId) {
      return {
        summary: 'Which ticket would you like to update? Please provide the ticket code (e.g. PTS-12).',
        options: [],
        candidateTickets: [],
      };
    }

    const qb = this.entityManager
      .createQueryBuilder(Ticket, 'ticket')
      .where('ticket.companyId = :companyId', { companyId })
      .andWhere('ticket.ticketSpaceId = :spaceId', { spaceId });

    // 2. Filter by status if requested
    if (filter.status) {
      const statusTerm = String(filter.status).trim().toLowerCase();
      let baseTerm: string | null = null;
      if (/^(open|todo|to\s*do|to\s*start|new|backlog)$/i.test(statusTerm)) baseTerm = StatusBaseEnum.TOSTART;
      else if (/^(in\s*progress|ongoing|processing|in\s*review)$/i.test(statusTerm)) baseTerm = StatusBaseEnum.PROCESSING;
      else if (/^(done|closed|resolved|completed)$/i.test(statusTerm)) baseTerm = StatusBaseEnum.FINISHED;

      if (baseTerm) {
        qb.andWhere('(LOWER(ticket.statusName) LIKE :status OR ticket.statusBase = :baseTerm)', {
          status: `%${statusTerm}%`,
          baseTerm,
        });
      } else {
        qb.andWhere('LOWER(ticket.statusName) LIKE :status', { status: `%${statusTerm}%` });
      }
    }

    // 3. Filter by Assignee if requested
    const requestedAssignee = filter.assignee;
    if (requestedAssignee) {
      const targetUser = String(requestedAssignee).trim().toLowerCase();
      if (['me', 'myself', 'i', 'self'].includes(targetUser)) {
        const userEmail = (authUser?.email || authUser?.userEmail || '').trim().toLowerCase();
        const userId = Number(authUser?.userId || authUser?.id || 0);
        qb.andWhere('(LOWER(ticket.assigneeEmail) = :userEmail OR ticket.assigneeId = :userId)', {
          userEmail,
          userId,
        });
      } else {
        qb.andWhere('LOWER(ticket.assigneeName) LIKE :assigneeLike', {
          assigneeLike: `%${targetUser}%`,
        });
      }
    }

    // 3. Filter by partial code or title if requested
    const query = filter.query || filter.title || filter.name || filter.search;
    if (query) {
      const q = String(query).trim().toLowerCase();
      qb.andWhere('(LOWER(ticket.code) LIKE :q OR LOWER(ticket.name) LIKE :q)', {
        q: `%${q}%`,
      });
    }

    qb.orderBy('ticket.id', 'DESC').take(15);
    const tickets = await qb.getMany();

    if (tickets.length === 0) {
      const desc = requestedAssignee ? `assigned to "${requestedAssignee}"` : '';
      return {
        summary: `I could not find any tickets ${desc} in this space. Which ticket would you like to update?`,
        options: [],
        candidateTickets: [],
      };
    }

    const totalCount = tickets.length;
    const allCodes = tickets.map((t) => t.code);
    const options: Array<{ id: number; name: string; label: string; actionText: string }> = [];

    // Option 0: All tickets (user-confirmed rule)
    options.push({
      id: 0,
      label: `All (${totalCount} tickets)`,
      name: `Move all (${allCodes.join(', ')}) to ${targetStatus}`,
      actionText: `Move all (${allCodes.join(', ')}) to ${targetStatus}`,
    });

    // Options 1..5: first 4-5 tickets individually
    const firstFew = tickets.slice(0, 5);
    firstFew.forEach((t, idx) => {
      const titleShort = t.name && t.name.length > 25 ? t.name.slice(0, 25) + '...' : (t.name || 'Untitled');
      options.push({
        id: idx + 1,
        label: `${t.code}: ${titleShort}`,
        name: `Move ${t.code} to ${targetStatus}`,
        actionText: `Move ${t.code} to ${targetStatus}`,
      });
    });

    const assigneeDesc = requestedAssignee ? `assigned to **${requestedAssignee}**` : '';
    const summary = `I found **${totalCount}** ticket${totalCount !== 1 ? 's' : ''} ${assigneeDesc} in this space. Which ticket(s) would you like to move to **${targetStatus}**?`;

    return {
      summary,
      options,
      candidateTickets: tickets.map((t) => ({ id: Number(t.id), code: t.code, name: t.name })),
    };
  }
}
