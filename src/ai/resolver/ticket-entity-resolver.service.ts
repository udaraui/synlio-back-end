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
        resolvedList.push(res.resolvedDraft);
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
        // If user says "me", "myself", "i", or "self", match with currentUser
        if (targetUser === 'me' || targetUser === 'myself' || targetUser === 'i' || targetUser === 'self') {
          const userEmail = (currentUser?.email || currentUser?.userEmail || '').trim().toLowerCase();
          const userId = Number(currentUser?.userId || currentUser?.id || 0);

          if (userEmail || userId > 0) {
            const memberRows: Array<{ id: number; userId: number; userFirstName: string; userLastName: string; userEmail: string }> = await this.entityManager.query(
              `SELECT "id", "userId", "userFirstName", "userLastName", "userEmail"
               FROM ticket_space_member
               WHERE "ticketSpaceId" = $1 AND (
                 (LOWER("userEmail") = $2 AND $2 != '') OR 
                 ($3 > 0 AND "userId" = $3)
               )`,
              [resolvedSpaceId, userEmail, userId]
            );

            if (memberRows.length > 0) {
              matchedMember = memberRows[0];
            }
          }
        } else {
          const memberRows: Array<{ id: number; userId: number; userFirstName: string; userLastName: string; userEmail: string }> = await this.entityManager.query(
            `SELECT "id", "userId", "userFirstName", "userLastName", "userEmail"
             FROM ticket_space_member
             WHERE "ticketSpaceId" = $1 AND (
               LOWER("userFirstName") LIKE $2 OR 
               LOWER("userLastName") LIKE $2 OR 
               LOWER(CONCAT("userFirstName", ' ', "userLastName")) LIKE $2 OR
               LOWER("userEmail") LIKE $2
             )`,
            [resolvedSpaceId, `%${targetUser}%`]
          );

          if (memberRows.length === 1) {
            matchedMember = memberRows[0];
          } else if (memberRows.length > 1) {
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
