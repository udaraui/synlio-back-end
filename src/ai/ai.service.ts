import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import axios from 'axios';
import { RedisService } from '../redis/redis.service';
import { getOrBuildVisibilityCache } from '../task-management/guards/visibility-cache.util';
import { TicketEntityResolverService } from './resolver/ticket-entity-resolver.service';
import { TicketMutationExecutorService } from './executor/ticket-mutation-executor.service';
import { TaskEntityResolverService } from './resolver/task-entity-resolver.service';
import { TaskMutationExecutorService } from './executor/task-mutation-executor.service';
import { Transform } from 'stream';

export function isTicketCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Za-z0-9]+-\d+$/i.test(code.trim());
}

export function isTaskCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  // Task codes must end with at least one digit after the alpha level prefix (e.g. PTS-P2, TSU-P10, PRJ-T3-S1)
  // This prevents hyphenated English words like "MEDIUM-priority", "MEDIMU-priority" from matching
  return /^[A-Za-z0-9]+-[A-Za-z]+\d+/i.test(code.trim());
}

export function extractEntityCodes(text: string): { ticketCodes: string[]; taskCodes: string[] } {
  if (!text || typeof text !== 'string') return { ticketCodes: [], taskCodes: [] };
  // Only extract codes that look like real entity codes, not hyphenated English words
  // Ticket codes: PREFIX-DIGITS only (e.g. PTS-23, SSD-5)
  // Task codes: PREFIX-LETTERSDIGITS (e.g. PTS-P2, PRJ-T3-S1) — alpha level prefix MUST be followed by digit
  const allCodes = text.match(/\b[A-Za-z0-9]+-[A-Za-z0-9_-]+\b/g) || [];
  const ticketCodes: string[] = [];
  const taskCodes: string[] = [];
  for (const c of allCodes) {
    if (isTicketCode(c)) {
      if (!ticketCodes.includes(c.toUpperCase())) ticketCodes.push(c.toUpperCase());
    } else if (isTaskCode(c)) {
      if (!taskCodes.includes(c.toUpperCase())) taskCodes.push(c.toUpperCase());
    }
  }
  return { ticketCodes, taskCodes };
}

@Injectable()
export class AiService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
    private readonly entityResolverService: TicketEntityResolverService,
    private readonly mutationExecutorService: TicketMutationExecutorService,
    private readonly taskEntityResolverService: TaskEntityResolverService,
    private readonly taskMutationExecutorService: TaskMutationExecutorService,
  ) {}

  private readonly activeAbortControllers = new Map<string, AbortController>();

  private readonly MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  private readonly MAX_ATTACHMENTS_COUNT = 5;
  private readonly ALLOWED_FILE_EXTENSIONS = new Set([
    '.pdf', '.docx', '.doc', '.txt', '.csv', '.md', '.markdown', '.json', '.log',
  ]);

  private validateAttachments(attachments?: any[]) {
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return;
    }

    if (attachments.length > this.MAX_ATTACHMENTS_COUNT) {
      throw new HttpException(
        `Too many attachments. A maximum of ${this.MAX_ATTACHMENTS_COUNT} files is allowed per request.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    for (const att of attachments) {
      if (!att || typeof att !== 'object') continue;

      const filename = String(att.filename || att.name || '').trim();
      if (!filename) {
        throw new HttpException('Attachment is missing a filename.', HttpStatus.BAD_REQUEST);
      }

      const extMatch = filename.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0].toLowerCase() : '';
      if (!this.ALLOWED_FILE_EXTENSIONS.has(ext)) {
        throw new HttpException(
          `Attachment "${filename}" has an unsupported file type (${ext || 'none'}). Allowed extensions are: ${Array.from(this.ALLOWED_FILE_EXTENSIONS).join(', ')}.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      let approximateSizeBytes = 0;
      if (typeof att.content === 'string') {
        const raw = att.content.includes(',') ? att.content.split(',')[1] : att.content;
        approximateSizeBytes = Math.floor((raw.length * 3) / 4);
      } else if (typeof att.contentText === 'string') {
        approximateSizeBytes = Buffer.byteLength(att.contentText, 'utf8');
      }

      if (approximateSizeBytes > this.MAX_ATTACHMENT_SIZE_BYTES) {
        throw new HttpException(
          `Attachment "${filename}" exceeds the maximum allowed size of 10 MB.`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async processChat(
    message: string,
    conversationId?: string,
    user?: { userId?: number; email?: string; username?: string; privileges?: any[]; [key: string]: any },
    companyId: number = 0,
    agent?: string,
    context?: any,
    chatMode?: string,
    history?: Array<{ role: string; content: string }>,
    pendingDraft?: any,
    attachments?: any,
  ): Promise<any> {
    // 0. Validate attachments security (size and allowed formats)
    this.validateAttachments(attachments);

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL;

      // 1. Resolve accessible ticket spaces (from Redis cache or SQL fallback)
      let allowedTicketSpaceIds: number[] = [];
      let allowedSpaces: Array<{ id: number; name: string; prefix?: string }> = [];

      if (user?.userId) {
        const ticketCacheKey = `user_accessible_ticket_spaces:${user.userId}`;
        const cachedTicketSpaces = await this.redisService.get(ticketCacheKey);
        if (cachedTicketSpaces) {
          try {
            allowedTicketSpaceIds = JSON.parse(cachedTicketSpaces);
          } catch {
            allowedTicketSpaceIds = [];
          }
        } else {
          const ticketSpaceRows = await this.entityManager.query(
            `SELECT "ticketSpaceId" FROM ticket_space_member WHERE "userId" = $1`,
            [user.userId]
          );
          allowedTicketSpaceIds = ticketSpaceRows.map((r: any) => Number(r.ticketSpaceId));
          await this.redisService.set(ticketCacheKey, JSON.stringify(allowedTicketSpaceIds));
        }

        // Fetch space metadata (names and prefixes) for AI context and selection
        if (allowedTicketSpaceIds.length > 0) {
          const spaces = await this.entityManager.query(
            `SELECT "id", "name", "prefix" 
             FROM ticket_space 
             WHERE "companyId" = $1 AND "id" = ANY($2::int[])`,
            [companyId, allowedTicketSpaceIds]
          );
          allowedSpaces = spaces.map((s: any) => ({
            id: Number(s.id),
            name: s.name,
            prefix: s.prefix,
          }));
        }
      }

      // 2. Resolve accessible task spaces and guest root task restrictions
      const allowedTaskSpaceIds: number[] = [];
      const rootTaskRestrictions: Record<string, number[]> = {};
      let allowedTaskSpaces: Array<{ id: number; name: string; prefix?: string }> = [];

      if (user?.email) {
        try {
          const visibilityDict = await getOrBuildVisibilityCache(
            this.entityManager,
            this.redisService,
            user.email,
            companyId,
            'task'
          );
          if (visibilityDict && typeof visibilityDict === 'object') {
            for (const [spaceIdStr, rootTaskIds] of Object.entries(visibilityDict)) {
              allowedTaskSpaceIds.push(Number(spaceIdStr));
              if (Array.isArray(rootTaskIds) && rootTaskIds.length > 0) {
                rootTaskRestrictions[spaceIdStr] = rootTaskIds.map(Number);
              }
            }
          }

          if (allowedTaskSpaceIds.length > 0) {
            const taskSpaces = await this.entityManager.query(
              `SELECT "id", "name", "prefix" 
               FROM task_space 
               WHERE "companyId" = $1 AND "id" = ANY($2::int[])`,
              [companyId, allowedTaskSpaceIds]
            );
            allowedTaskSpaces = taskSpaces.map((s: any) => ({
              id: Number(s.id),
              name: s.name,
              prefix: s.prefix,
            }));
          }
        } catch (err) {
          console.error('Error fetching task visibility cache in AiService:', err);
        }
      }

      // 3. Evaluate Create Ticket Permission (Permission 103)
      const userPrivs = user?.privileges || [];
      const companyPriv = userPrivs.find((p: any) => Number(p.companyId) === Number(companyId));
      const privilegeIds: number[] = companyPriv?.privilegeIds || [];
      const canCreateTicket = privilegeIds.includes(103) || privilegeIds.length === 0 || !user?.privileges;

      const { ticketCodes: msgTicketCodes, taskCodes: msgTaskCodes } = extractEntityCodes(message || '');

      let isTaskDomain = false;
      if (agent === 'ticket_analytics') {
        // Ticket Analyst authority: NEVER treat as task domain unless user explicitly specified a task code
        isTaskDomain = msgTaskCodes.length > 0 && msgTicketCodes.length === 0;
      } else if (agent === 'project_analytics') {
        // Project Analyst authority: NEVER treat as ticket domain unless user explicitly specified a ticket code
        isTaskDomain = !(msgTicketCodes.length > 0 && msgTaskCodes.length === 0);
      } else {
        // General or default agent
        if (msgTaskCodes.length > 0 && msgTicketCodes.length === 0) {
          isTaskDomain = true;
        } else if (msgTicketCodes.length > 0 && msgTaskCodes.length === 0) {
          isTaskDomain = false;
        } else {
          isTaskDomain =
            context?.spaceType === 'task' ||
            context?.entityType === 'task' ||
            !!context?.taskSpaceId ||
            (Array.isArray(pendingDraft)
              ? pendingDraft.some((d: any) => d?.entityType === 'task' || d?.parentTaskId || d?.parentTaskName)
              : (pendingDraft?.entityType === 'task' || pendingDraft?.parentTaskId || pendingDraft?.parentTaskName));
        }
      }

      // 4. Prepare payload for Python LangGraph backend
      const payload = {
        message,
        conversation_id: conversationId,
        user_id: user?.userId,
        user_email: user?.email,
        user_name: user?.username,
        chat_mode: chatMode || context?.chatMode || context?.mode || 'panel',
        company_id: companyId,
        agent,
        context,
        history,
        pending_draft: pendingDraft,
        pendingDraft: pendingDraft,
        attachments,
        scope: {
          allowed_ticket_space_ids: allowedTicketSpaceIds,
          allowed_task_space_ids: allowedTaskSpaceIds,
          allowed_spaces: isTaskDomain && allowedTaskSpaces.length > 0 ? allowedTaskSpaces : allowedSpaces,
          allowed_ticket_spaces: allowedSpaces,
          allowed_task_spaces: allowedTaskSpaces,
          root_task_restrictions: rootTaskRestrictions,
          can_create_ticket: canCreateTicket,
        },
      };

      // 5. Forward the request to the Python LangGraph backend as a stream
      const abortController = new AbortController();
      if (conversationId) {
        this.activeAbortControllers.set(conversationId, abortController);
      }

      let response;
      try {
        response = await axios.post(
          `${aiServiceUrl}/chat`,
          payload,
          {
            signal: abortController.signal,
            responseType: 'stream',
          },
        );
      } catch (postErr) {
        if (conversationId) {
          this.activeAbortControllers.delete(conversationId);
        }
        throw postErr;
      }

      // 6. Transparent Stream Transform with Entity Resolution and Mutation Execution
      const entityResolver = this.entityResolverService;
      const mutationExecutor = this.mutationExecutorService;
      const taskEntityResolver = this.taskEntityResolverService;
      const taskMutationExecutor = this.taskMutationExecutorService;
      let buffer = '';

      const transformStream = new Transform({
        async transform(chunk, encoding, callback) {
          const text = chunk.toString();
          buffer += text;

          // Check if buffer contains a mutation payload marker
          if (buffer.includes('__MUTATION_PAYLOAD__')) {
            const parts = buffer.split('__MUTATION_PAYLOAD__');
            const beforeMarker = parts[0];
            const jsonPart = parts[1];

            let parsed: any;
            try {
              parsed = JSON.parse(jsonPart.trim());
            } catch {
              // Incomplete chunk, keep waiting in buffer (do not push raw chunk downstream)
              return callback();
            }

            try {
              const rawTargets: any[] = parsed.targets || [];
              const targets: string[] = rawTargets.map((t: any) => String(t).trim());
              const hasTaskTargets = targets.some((t) => isTaskCode(t));
              const hasTicketTargets = targets.some((t) => isTicketCode(t));

              // Domain Guardrail Checks (Option 2: Strict Domain Boundary)
              if (
                agent === 'project_analytics' &&
                (parsed.action === 'UPDATE_TICKET' ||
                  parsed.entityType === 'ticket' ||
                  (hasTicketTargets && !hasTaskTargets))
              ) {
                this.push(
                  `__FINAL__I am your **Project Analyst**, specialized in tasks, milestones, and projects. To manage or analyze tickets and bugs, please switch to the **Ticket Analyst** from the agent selector or navigate to the Ticket Management page.\n\n`
                );
                buffer = '';
                return callback();
              }

              if (
                agent === 'ticket_analytics' &&
                (hasTaskTargets && !hasTicketTargets)
              ) {
                this.push(
                  `__FINAL__I am your **Ticket Analyst**, specialized in tickets, bugs, and issues. To manage or analyze tasks and projects, please switch to the **Project Analyst** from the agent selector or navigate to the Task Management page.\n\n`
                );
                buffer = '';
                return callback();
              }

              let isTaskMutation = false;
              if (hasTaskTargets && !hasTicketTargets) {
                isTaskMutation = true;
              } else if (hasTicketTargets && !hasTaskTargets) {
                isTaskMutation = false;
              } else if (agent === 'ticket_analytics') {
                isTaskMutation = false;
              } else if (agent === 'project_analytics') {
                isTaskMutation = true;
              } else if (parsed.action === 'UPDATE_TASK' || parsed.entityType === 'task') {
                isTaskMutation = true;
              } else if (parsed.action === 'UPDATE_TICKET' || parsed.entityType === 'ticket') {
                isTaskMutation = false;
              } else {
                isTaskMutation = true;
              }

              // Refusal Guard (e.g. Hierarchy Immutability or permission block)
              if (parsed.status === 'REFUSED') {
                this.push(`__FINAL__${beforeMarker.trim() || parsed.summary}\n\n`);
                buffer = '';
                return callback();
              }

              if (isTaskMutation) {
                // Task Mutation Logic
                if (targets.length === 0 || parsed.status === 'NEEDS_INPUT') {
                  const targetSpaceId = Number(
                    context?.task_space_id ||
                    context?.taskSpaceId ||
                    (allowedTaskSpaceIds && allowedTaskSpaceIds[0]) ||
                    0
                  );

                  const candidates = await taskMutationExecutor.findCandidateTasks(
                    parsed,
                    companyId,
                    user,
                    targetSpaceId,
                  );

                  // If user requested bulk mutation (all: true), prepare draft for all candidate tasks directly
                  if (parsed.filter?.all && candidates.candidateTasks?.length > 0) {
                    const batchTargets = candidates.candidateTasks.map((t: any) => t.code);
                    const mutationDraft = await taskMutationExecutor.prepareTaskMutationDraft(
                      { ...parsed, targets: batchTargets, status: 'READY' },
                      companyId,
                      user,
                    );

                    let displaySummary = mutationDraft.summary;
                    if (mutationDraft.warnings && mutationDraft.warnings.length > 0) {
                      const uniqueWarnings = Array.from(new Set(mutationDraft.warnings as string[]));
                      displaySummary += '\n\n' + uniqueWarnings.join('\n\n');
                    }

                    this.push(`__FINAL__${displaySummary}\n\n__DRAFT_PAYLOAD__${JSON.stringify(mutationDraft)}`);
                    buffer = '';
                    return callback();
                  }

                  const optionsPayload = {
                    action: 'UPDATE_TASK',
                    entityType: 'task',
                    status: 'NEEDS_INPUT',
                    summary: candidates.summary,
                    changes: parsed.changes || {},
                    options: candidates.options,
                    candidateTasks: candidates.candidateTasks,
                    needs: [
                      {
                        field: 'targetTask',
                        label: 'Select Task',
                        options: candidates.options.map((o) => ({
                          id: o.id,
                          name: o.actionText,
                          label: o.label,
                        })),
                      },
                    ],
                  };

                  this.push(`__FINAL__${beforeMarker.trim()}\n\n__DRAFT_PAYLOAD__${JSON.stringify(optionsPayload)}`);
                  buffer = '';
                  return callback();
                }

                // Explicit targets provided -> prepare task mutation draft
                const mutationDraft = await taskMutationExecutor.prepareTaskMutationDraft(
                  parsed,
                  companyId,
                  user,
                );

                if (mutationDraft.status === 'REFUSED') {
                  this.push(`__FINAL__${mutationDraft.summary}\n\n`);
                  buffer = '';
                  return callback();
                }

                if (mutationDraft.drafts.length === 0) {
                  this.push(`__FINAL__${mutationDraft.summary}\n\n`);
                  buffer = '';
                  return callback();
                }

                let displaySummary = beforeMarker.trim();
                if (mutationDraft.warnings && mutationDraft.warnings.length > 0) {
                  const uniqueWarnings = Array.from(new Set(mutationDraft.warnings as string[]));
                  displaySummary += '\n\n' + uniqueWarnings.join('\n\n');
                }

                this.push(`__FINAL__${displaySummary}\n\n__DRAFT_PAYLOAD__${JSON.stringify(mutationDraft)}`);
                buffer = '';
                return callback();
              }

              // Ticket Mutation Logic
              // If no explicit targets were specified, resolve candidate tickets and return options
              if (targets.length === 0 || parsed.status === 'NEEDS_INPUT') {
                const requestedSpaceId = Number(
                  context?.ticketSpaceId ||
                  context?.spaceId ||
                  (allowedTicketSpaceIds && allowedTicketSpaceIds[0]) ||
                  0
                );

                const candidates = await mutationExecutor.findCandidateTickets(
                  parsed,
                  companyId,
                  allowedTicketSpaceIds,
                  user,
                  requestedSpaceId,
                );

                // If user requested bulk mutation (all: true), prepare draft for all candidate tickets directly
                if (parsed.filter?.all && candidates.candidateTickets?.length > 0) {
                  const batchTargets = candidates.candidateTickets.map((t: any) => t.code);
                  const mutationDraft = await mutationExecutor.prepareTicketMutationDraft(
                    { ...parsed, targets: batchTargets, status: 'READY' },
                    companyId,
                    allowedTicketSpaceIds,
                    user,
                  );

                  let displaySummary = mutationDraft.summary;
                  if (mutationDraft.warnings && mutationDraft.warnings.length > 0) {
                    const uniqueWarnings = Array.from(new Set(mutationDraft.warnings as string[]));
                    displaySummary += '\n\n' + uniqueWarnings.join('\n\n');
                  }

                  this.push(`__FINAL__${displaySummary}\n\n__DRAFT_PAYLOAD__${JSON.stringify(mutationDraft)}`);
                  buffer = '';
                  return callback();
                }

                const optionsPayload = {
                  action: 'UPDATE_TICKET',
                  status: 'NEEDS_INPUT',
                  summary: candidates.summary,
                  changes: parsed.changes || {},
                  options: candidates.options,
                  candidateTickets: candidates.candidateTickets,
                  needs: [
                    {
                      field: 'targetTicket',
                      label: 'Select Ticket',
                      options: candidates.options.map((o) => ({
                        id: o.id,
                        name: o.actionText,
                        label: o.label,
                      })),
                    },
                  ],
                };

                this.push(`__FINAL__${beforeMarker.trim()}\n\n__DRAFT_PAYLOAD__${JSON.stringify(optionsPayload)}`);
                buffer = '';
                return callback();
              }

              // Explicit targets were provided -> prepare mutation draft for UI confirmation
              const mutationDraft = await mutationExecutor.prepareTicketMutationDraft(
                parsed,
                companyId,
                allowedTicketSpaceIds,
                user,
              );

              if (mutationDraft.drafts.length === 0) {
                // Ticket(s) not found in database! Stream the friendly not found message and do NOT show a draft card!
                this.push(`__FINAL__${mutationDraft.summary}\n\n`);
                buffer = '';
                return callback();
              }

              let displaySummary = beforeMarker.trim();
              if (mutationDraft.warnings && mutationDraft.warnings.length > 0) {
                const uniqueWarnings = Array.from(new Set(mutationDraft.warnings as string[]));
                if (mutationDraft.allUnrecognized) {
                  displaySummary = uniqueWarnings.join('\n\n');
                } else {
                  displaySummary += '\n\n' + uniqueWarnings.join('\n\n');
                }
              }

              this.push(`__FINAL__${displaySummary}\n\n__DRAFT_PAYLOAD__${JSON.stringify(mutationDraft)}`);
              buffer = '';
              return callback();
            } catch (err: any) {
              console.error('Error in mutation processing:', err);
              this.push(`__FINAL__I encountered an issue preparing the update draft: ${err.message || 'Please try again.'}\n\n`);
              buffer = '';
              return callback();
            }
          }

          // Check if buffer contains a draft payload marker
          if (buffer.includes('__DRAFT_PAYLOAD__')) {
            const parts = buffer.split('__DRAFT_PAYLOAD__');
            const beforeMarker = parts[0];
            const jsonPart = parts[1];

            try {
              const parsed = JSON.parse(jsonPart.trim());
              const parsedDrafts = Array.isArray(parsed.drafts)
                ? parsed.drafts
                : (parsed.draft ? [parsed.draft] : (Array.isArray(parsed) ? parsed : [parsed]));

              // Domain Guardrail Checks (Option 2: Strict Domain Boundary)
              if (
                agent === 'project_analytics' &&
                (parsed.action === 'CREATE_TICKET' ||
                  parsed.entityType === 'ticket' ||
                  (msgTicketCodes.length > 0 && msgTaskCodes.length === 0))
              ) {
                this.push(
                  `__FINAL__I am your **Project Analyst**, specialized in tasks, milestones, and projects. To manage or analyze tickets and bugs, please switch to the **Ticket Analyst** from the agent selector or navigate to the Ticket Management page.\n\n`
                );
                buffer = '';
                return callback();
              }

              if (
                agent === 'ticket_analytics' &&
                (msgTaskCodes.length > 0 && msgTicketCodes.length === 0)
              ) {
                this.push(
                  `__FINAL__I am your **Ticket Analyst**, specialized in tickets, bugs, and issues. To manage or analyze tasks and projects, please switch to the **Project Analyst** from the agent selector or navigate to the Task Management page.\n\n`
                );
                buffer = '';
                return callback();
              }

              let isTaskDraft = false;
              if (agent === 'ticket_analytics') {
                // Strictly ticket domain unless user explicitly targeted a task code
                isTaskDraft = msgTaskCodes.length > 0 && msgTicketCodes.length === 0;
              } else if (agent === 'project_analytics') {
                // Strictly task domain unless user explicitly targeted a ticket code
                isTaskDraft = !(msgTicketCodes.length > 0 && msgTaskCodes.length === 0);
              } else {
                isTaskDraft =
                  parsed.action === 'CREATE_TASK' ||
                  parsed.entityType === 'task' ||
                  parsedDrafts.some((d: any) => d?.entityType === 'task' || d?.parentTaskId || d?.parentTaskName);
              }

              if (isTaskDraft) {
                const targetDrafts = parsed.drafts && Array.isArray(parsed.drafts) && parsed.drafts.length > 0
                  ? parsed.drafts
                  : (parsed.draft || parsed);

                const { resolvedDraft, warnings, needs, summary } = await taskEntityResolver.resolveDraftEntities(
                  targetDrafts,
                  companyId,
                  allowedTaskSpaceIds,
                  user,
                  context,
                );

                const isArray = Array.isArray(resolvedDraft);
                const allWarnings = [...(parsed.warnings || []), ...warnings];
                const resolvedPayload = {
                  action: 'CREATE_TASK',
                  entityType: 'task',
                  status: (needs && needs.length > 0) ? 'NEEDS_INPUT' : (parsed.status || 'READY'),
                  summary: summary || parsed.summary,
                  draft: isArray ? resolvedDraft[0] : resolvedDraft,
                  drafts: isArray ? resolvedDraft : (parsed.drafts || [resolvedDraft]),
                  warnings: allWarnings,
                  needs: needs && needs.length > 0 ? needs : (parsed.needs || []),
                };

                const targetDraftsList = Array.isArray(resolvedDraft) ? resolvedDraft : [resolvedDraft];
                const count = targetDraftsList.length;
                const parentEntry = targetDraftsList.find((d: any) => d?.parentTaskId && d?.parentTaskId > 0 && (d?.parentTaskCode || d?.parentTaskName));
                const newRootProject = targetDraftsList.find((d: any) => d?.isCreateNewLevel1 || d?.hierarchyLevelSequence === 0 || d?.parentTaskId === -1);

                const pCode = parentEntry?.parentTaskCode || '';
                const pName = parentEntry?.parentTaskName || '';
                const pLabel = pCode && pName ? `${pCode}: ${pName}` : pCode || pName;

                let displaySummary = "";
                if (resolvedPayload.status === 'NEEDS_INPUT') {
                  displaySummary = summary || parsed.summary || beforeMarker.trim();
                } else if (pLabel) {
                  displaySummary = `I've prepared ${count > 1 ? `${count} tasks` : 'your task draft'} under **${pLabel}** for your review.`;
                } else if (newRootProject && count > 1) {
                  const rootName = newRootProject.name || 'new project';
                  displaySummary = `I've prepared **${rootName}** with ${count - 1} child tasks for your review.`;
                } else {
                  displaySummary = `I've prepared ${count > 1 ? `${count} tasks` : 'your task draft'} for your review.`;
                }

                if (resolvedPayload.status !== 'NEEDS_INPUT') {
                  if (allWarnings.length > 0) {
                    const cleanWarnings = Array.from(new Set(allWarnings)).map((w) => {
                      return w.replace(/^Assignee "(.*?)" is not assigned to space "(.*?)". Please select from assigned space resources.?/i, 'Assignee "$1" is not assigned to this space; please select from available space resources in the table below.');
                    });
                    displaySummary += ` Note: ${cleanWarnings.join(' ')}`;
                  } else {
                    displaySummary += ' Please review and adjust the details in the table before saving.';
                  }
                }

                this.push(`__FINAL__${displaySummary}\n\n__DRAFT_PAYLOAD__${JSON.stringify(resolvedPayload)}`);
                buffer = '';
                return callback();
              }

              // Ticket Draft Logic
              const rawTargetDrafts = parsed.drafts && Array.isArray(parsed.drafts) && parsed.drafts.length > 0
                ? parsed.drafts
                : (parsed.draft || parsed);

              // Sanitize drafts to clean ticket entities (stripping task-specific hierarchy fields)
              const sanitizeTicketItem = (d: any) => {
                if (!d || typeof d !== 'object') return d;
                const clean = { ...d };
                clean.entityType = 'ticket';
                if (clean.taskSpaceName && !clean.ticketSpaceName) {
                  clean.ticketSpaceName = clean.taskSpaceName;
                }
                if (clean.taskSpaceId && !clean.ticketSpaceId) {
                  clean.ticketSpaceId = clean.taskSpaceId;
                }
                delete clean.taskSpaceName;
                delete clean.taskSpaceId;
                delete clean.parentTaskId;
                delete clean.parentTaskName;
                delete clean.parentTaskCode;
                delete clean.hierarchyLevelSequence;
                delete clean.hierarchyLevelName;
                delete clean.isCreateNewLevel1;
                return clean;
              };

              const targetDrafts = Array.isArray(rawTargetDrafts)
                ? rawTargetDrafts.map(sanitizeTicketItem)
                : sanitizeTicketItem(rawTargetDrafts);

              const { resolvedDraft, warnings } = await entityResolver.resolveDraftEntities(
                targetDrafts,
                companyId,
                allowedTicketSpaceIds,
                user,
                context,
              );

              const isArray = Array.isArray(resolvedDraft);
              const allWarnings = [...(parsed.warnings || []), ...warnings];
              const resolvedPayload = {
                action: parsed.action || 'CREATE_TICKET',
                status: parsed.status || 'READY',
                summary: parsed.summary,
                draft: isArray ? resolvedDraft[0] : resolvedDraft,
                drafts: isArray ? resolvedDraft : (parsed.drafts || [resolvedDraft]),
                warnings: allWarnings,
                needs: parsed.needs || [],
              };

              let displaySummary = beforeMarker.trim();
              if (allWarnings.length > 0) {
                const uniqueWarnings = Array.from(new Set(allWarnings));
                displaySummary += '\n\n' + uniqueWarnings.map((w) => `${w}`).join('\n');
              }

              this.push(`__FINAL__${displaySummary}\n\n__DRAFT_PAYLOAD__${JSON.stringify(resolvedPayload)}`);
              buffer = '';
              return callback();
            } catch {
              // Incomplete chunk, keep waiting in buffer (do not push raw chunk downstream)
              return callback();
            }
          }

          this.push(chunk);
          callback();
        },
      });

      const cleanup = () => {
        if (conversationId) {
          this.activeAbortControllers.delete(conversationId);
        }
      };
      transformStream.on('close', cleanup);
      transformStream.on('finish', cleanup);
      transformStream.on('error', cleanup);
      response.data.on('close', cleanup);
      response.data.on('end', cleanup);

      return response.data.pipe(transformStream);
    } catch (error) {
      console.error('Error proxying to LangGraph service:', error);
      throw new HttpException(
        'Failed to process chat with AI service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async stopChat(conversationId: string) {
    if (!conversationId) return { status: 'no_conversation_id' };

    // 1. Abort upstream axios stream if still active
    const controller = this.activeAbortControllers.get(conversationId);
    if (controller) {
      try {
        controller.abort();
      } catch (err) {
        console.warn(`Error aborting NestJS stream for conversation ${conversationId}:`, err);
      }
      this.activeAbortControllers.delete(conversationId);
    }

    // 2. Call Python LangGraph backend /chat/stop
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    try {
      await axios.post(
        `${aiServiceUrl}/chat/stop`,
        { conversation_id: conversationId },
        { timeout: 3000 },
      );
    } catch {
      // Ignore if AI service was already disconnected
    }

    return { status: 'stopped', conversationId };
  }
}
