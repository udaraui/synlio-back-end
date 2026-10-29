import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export interface ResolutionResult {
  resolvedDraft: any;
  warnings: string[];
}

@Injectable()
export class TicketEntityResolverService {
  constructor(private readonly entityManager: EntityManager) {}

  /**
   * Deterministically resolves fuzzy names in an AI ticket draft into database IDs.
   */
  async resolveDraftEntities(
    draftOrDrafts: any,
    companyId: number,
    allowedSpaceIds: number[] = [],
    currentUser?: any,
  ): Promise<ResolutionResult> {
    if (!draftOrDrafts || typeof draftOrDrafts !== 'object') {
      return { resolvedDraft: draftOrDrafts, warnings: [] };
    }

    if (Array.isArray(draftOrDrafts)) {
      const resolvedList: any[] = [];
      const allWarnings: string[] = [];
      for (const d of draftOrDrafts) {
        const res = await this.resolveSingleDraft(d, companyId, allowedSpaceIds, currentUser);
        resolvedList.push({
          ...res.resolvedDraft,
          warnings: res.warnings,
        });
        for (const w of res.warnings) {
          if (!allWarnings.includes(w)) {
            allWarnings.push(w);
          }
        }
      }
      return { resolvedDraft: resolvedList, warnings: allWarnings };
    }

    return this.resolveSingleDraft(draftOrDrafts, companyId, allowedSpaceIds, currentUser);
  }

  private async resolveSingleDraft(
    draft: any,
    companyId: number,
    allowedSpaceIds: number[] = [],
    currentUser?: any,
  ): Promise<ResolutionResult> {
    if (!draft || typeof draft !== 'object') {
      return { resolvedDraft: draft, warnings: [] };
    }

    const resolved = { ...draft };
    const warnings: string[] = [];

    // 1. Resolve Ticket Space
    let resolvedSpaceId = resolved.ticketSpaceId ? Number(resolved.ticketSpaceId) : null;
    if (!resolvedSpaceId && resolved.ticketSpaceName && allowedSpaceIds.length > 0) {
      const targetName = resolved.ticketSpaceName.trim().toLowerCase();
      const spaces: Array<{ id: number; name: string }> = await this.entityManager.query(
        `SELECT "id", "name" 
         FROM ticket_space 
         WHERE "companyId" = $1 AND "id" = ANY($2::int[])`,
        [companyId, allowedSpaceIds]
      );

      // Exact or partial match
      const matched = spaces.find(
        (s) => s.name.toLowerCase() === targetName
      ) || spaces.find(
        (s) => s.name.toLowerCase().includes(targetName) || targetName.includes(s.name.toLowerCase())
      );

      if (matched) {
        resolved.ticketSpaceId = Number(matched.id);
        resolved.ticketSpaceName = matched.name;
        resolvedSpaceId = resolved.ticketSpaceId;
      } else {
        warnings.push(`Could not find a ticket space matching "${resolved.ticketSpaceName}". Please select one.`);
      }
    }

    // 2. Resolve Type, Severity, and Status (requires resolvedSpaceId)
    if (resolvedSpaceId) {
      // Resolve Ticket Type
      if (resolved.ticketTypeName && !resolved.ticketTypeId) {
        const typeRows: Array<{ id: number; name: string }> = await this.entityManager.query(
          `SELECT "id", "name" FROM ticket_space_type_config WHERE "ticketSpaceId" = $1`,
          [resolvedSpaceId]
        );
        const targetType = resolved.ticketTypeName.trim().toLowerCase();
        const matchedType = typeRows.find((t) => t.name.toLowerCase() === targetType) ||
          typeRows.find((t) => t.name.toLowerCase().includes(targetType) || targetType.includes(t.name.toLowerCase()));
        if (matchedType) {
          resolved.ticketTypeId = Number(matchedType.id);
          resolved.ticketTypeName = matchedType.name;
        }
      }

      // Resolve Severity
      if (resolved.severityName && !resolved.severityId) {
        const sevRows: Array<{ id: number; name: string }> = await this.entityManager.query(
          `SELECT "id", "name" FROM ticket_space_severity_config WHERE "ticketSpaceId" = $1`,
          [resolvedSpaceId]
        );
        const targetSev = resolved.severityName.trim().toLowerCase();
        const matchedSev = sevRows.find((s) => s.name.toLowerCase() === targetSev) ||
          sevRows.find((s) => s.name.toLowerCase().includes(targetSev) || targetSev.includes(s.name.toLowerCase()));
        if (matchedSev) {
          resolved.severityId = Number(matchedSev.id);
          resolved.severityName = matchedSev.name;
        }
      }

      // Resolve Status
      if (resolved.statusName && !resolved.statusId) {
        const statusRows: Array<{ id: number; name: string }> = await this.entityManager.query(
          `SELECT "id", "name" FROM ticket_space_status_config WHERE "ticketSpaceId" = $1`,
          [resolvedSpaceId]
        );
        const targetStatus = resolved.statusName.trim().toLowerCase();
        const matchedStatus = statusRows.find((s) => s.name.toLowerCase() === targetStatus) ||
          statusRows.find((s) => s.name.toLowerCase().includes(targetStatus) || targetStatus.includes(s.name.toLowerCase()));
        if (matchedStatus) {
          resolved.statusId = Number(matchedStatus.id);
          resolved.statusName = matchedStatus.name;
        }
      }
    }

    // 3. Resolve Assignee
    if (resolved.assigneeName && !resolved.assigneeId) {
      const targetUser = resolved.assigneeName.trim().toLowerCase();
      let matchedMember: any = null;

      if (resolvedSpaceId) {
        // Query space members joined with user table to tolerate nulls, whitespace, and denormalized lag
        const members: Array<{ id: number; userId: number; userFirstName: string; userLastName: string; userEmail: string }> = await this.entityManager.query(
          `SELECT m."id", m."userId",
                  COALESCE(NULLIF(TRIM(m."userFirstName"), ''), TRIM(u.first_name), '') AS "userFirstName",
                  COALESCE(NULLIF(TRIM(m."userLastName"), ''), TRIM(u.last_name), '') AS "userLastName",
                  COALESCE(NULLIF(TRIM(m."userEmail"), ''), TRIM(u.email), '') AS "userEmail"
           FROM ticket_space_member m
           LEFT JOIN "user" u ON u.id = m."userId"
           WHERE m."ticketSpaceId" = $1`,
          [resolvedSpaceId]
        );

        // If user says "me", "myself", "i", or "self", match with currentUser
        if (targetUser === 'me' || targetUser === 'myself' || targetUser === 'i' || targetUser === 'self') {
          const userEmail = (currentUser?.email || currentUser?.userEmail || '').trim().toLowerCase();
          const userId = Number(currentUser?.userId || currentUser?.id || 0);

          matchedMember = members.find(
            (m) =>
              (userEmail && m.userEmail.toLowerCase() === userEmail) ||
              (userId > 0 && Number(m.userId) === userId)
          );
        } else {
          const normalizedTarget = targetUser.replace(/\s+/g, ' ').trim();

          // 1. Exact match on full name, email, or email username
          let matchedList = members.filter((m) => {
            const full = `${m.userFirstName} ${m.userLastName}`.toLowerCase().replace(/\s+/g, ' ').trim();
            const email = (m.userEmail || '').toLowerCase().trim();
            const emailPrefix = email.split('@')[0];
            return full === normalizedTarget || email === normalizedTarget || emailPrefix === normalizedTarget;
          });

          // 2. Fuzzy inclusion match (whitespace resilient)
          if (matchedList.length === 0) {
            matchedList = members.filter((m) => {
              const full = `${m.userFirstName} ${m.userLastName}`.toLowerCase().replace(/\s+/g, ' ').trim();
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

          if (matchedList.length === 1) {
            matchedMember = matchedList[0];
          } else if (matchedList.length > 1) {
            warnings.push(`Multiple team members found matching "${resolved.assigneeName}". Please choose an assignee in the card.`);
          }
        }
      }

      if (matchedMember) {
        resolved.assigneeId = Number(matchedMember.id);
        resolved.assigneeName = `${matchedMember.userFirstName || ''} ${matchedMember.userLastName || ''}`.trim() || matchedMember.userEmail;
      } else if (!warnings.some((w) => w.includes('Multiple team members'))) {
        if (targetUser === 'me' || targetUser === 'myself' || targetUser === 'i' || targetUser === 'self') {
          warnings.push(`You (${currentUser?.email || 'logged-in user'}) are not a member of this ticket space.`);
        } else {
          warnings.push(`No team member matching "${resolved.assigneeName}" was found in this space.`);
        }
      }
    }

    return { resolvedDraft: resolved, warnings };
  }
}
