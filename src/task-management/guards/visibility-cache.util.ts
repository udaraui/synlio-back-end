import { EntityManager } from 'typeorm';
import { RedisService } from '../../redis/redis.service';

/**
 * Builds or retrieves the unified visibility cache for a user.
 * Returns a dictionary mapping taskSpaceId -> taskId[]
 * - An empty array `[]` means Full Access (Owner/Space Member).
 * - An array with IDs `[10, 11]` means Guest Access (restricted to those root task IDs).
 * - If a spaceId is not in the dictionary, the user has NO access.
 */
export async function getOrBuildVisibilityCache(
  entityManager: EntityManager,
  redisService: RedisService,
  email: string,
  companyId: number,
  logContext: 'task' | 'task space'
): Promise<Record<number, number[]>> {
  // console.time(`VisibilityCache Build (${logContext})`);
  const cacheKey = `user_accessible_task_spaces:userId_${email.toLowerCase()}`;
  const cachedData = await redisService.hget(cacheKey, `companyId_${companyId}`);

  if (cachedData) {
    const parsed = JSON.parse(cachedData);
    if (!Array.isArray(parsed)) {
      console.log(`getting ${logContext} data from cache for user: ${email}, company :${companyId}`);
      // console.timeEnd(`VisibilityCache Build (${logContext})`);
      return parsed;
    }
    // If it's an array, it's the old cache format. Ignore and rebuild.
  }

  console.log(`getting ${logContext} data from db for user: ${email}, company :${companyId}`);

  const visibilityDict: Record<number, number[]> = {};

  // 1. Full access via Space Owner
  const ownerSpaces = await entityManager.query(`
    SELECT tso."taskSpaceId" 
    FROM task_space_owners tso
    INNER JOIN "user" u ON tso."userId" = u.id
    WHERE LOWER(u.email) = LOWER($1)
  `, [email]);

  for (const row of ownerSpaces) {
    visibilityDict[row.taskSpaceId] = [];
  }

  // 2. Full access via Space Member
  const memberSpaces = await entityManager.query(`
    SELECT tsr."taskSpaceId" 
    FROM task_space_resources tsr
    INNER JOIN resource r ON tsr."resourceId" = r.id
    WHERE LOWER(r.email) = LOWER($1) AND r."companyId" = $2
  `, [email, companyId !== 0 ? companyId : null]);

  for (const row of memberSpaces) {
    visibilityDict[row.taskSpaceId] = [];
  }

  // 3. Guest access via Task Member (Root tasks + recursive children)
  const guestTasks = await entityManager.query(`
    WITH RECURSIVE TaskTree AS (
      SELECT t.id as "taskId", t."taskSpaceId"
      FROM tm_task t
      INNER JOIN tm_task_members tm ON t.id = tm."taskId"
      INNER JOIN resource r ON tm."resourceId" = r.id
      WHERE LOWER(r.email) = LOWER($1) AND r."companyId" = $2 AND t."parentTaskId" IS NULL
      
      UNION
      
      SELECT child.id as "taskId", child."taskSpaceId"
      FROM tm_task child
      INNER JOIN TaskTree parent ON child."parentTaskId" = parent."taskId"
    )
    SELECT "taskId", "taskSpaceId" FROM TaskTree;
  `, [email, companyId !== 0 ? companyId : null]);

  for (const row of guestTasks) {
    const spaceId = row.taskSpaceId;
    const taskId = row.taskId;

    // If the space is already marked for full access ([]), we do nothing.
    if (visibilityDict[spaceId] && visibilityDict[spaceId].length === 0) {
      continue;
    }

    if (!visibilityDict[spaceId]) {
      visibilityDict[spaceId] = [];
    }
    visibilityDict[spaceId].push(taskId);
  }

  // Save to Redis
  await redisService.hset(cacheKey, `companyId_${companyId}`, JSON.stringify(visibilityDict));

  // console.timeEnd(`VisibilityCache Build (${logContext})`);
  return visibilityDict;
}
