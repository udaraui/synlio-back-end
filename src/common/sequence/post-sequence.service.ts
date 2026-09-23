import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { PostSequence, PostType } from './post-sequence.entity';

@Injectable()
export class PostSequenceService {
  /** Shared helper: returns the MAX trailing number found in actual task/ticket rows. */
  private async queryActualMax(
    manager: EntityManager,
    companyId: number,
    spaceId: number,
    postType: PostType,
    levelPrefix: string | null,
    parentTaskId: number | null,
  ): Promise<number> {
    let tableName = '';
    let spaceCol = '';
    if (postType === PostType.TSK) {
      tableName = 'tm_task';
      spaceCol = '"taskSpaceId"';
    } else if (postType === PostType.TKT) {
      tableName = 'ticket';
      spaceCol = '"ticketSpaceId"';
    }
    if (!tableName) return 0;

    let regexPattern = '';
    if (levelPrefix) {
      const escapedPrefix = levelPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&');
      regexPattern = `(^|-)${escapedPrefix}[0-9]+$`;
    } else {
      regexPattern = '[0-9]+$';
    }

    const queryParams: any[] = [companyId, spaceId, regexPattern];
    let parentSql = '';
    if (parentTaskId !== null) {
      parentSql = ` AND "parentTaskId" = $4`;
      queryParams.push(parentTaskId);
    } else if (postType === PostType.TSK) {
      parentSql = ` AND "parentTaskId" IS NULL`;
    }

    const [result] = await manager.query(
      `SELECT MAX(SUBSTRING(code FROM '([0-9]+)$')::int) AS "maxNum"
       FROM ${tableName}
       WHERE "companyId" = $1 AND ${spaceCol} = $2
         AND code ~ $3 ${parentSql}`,
      queryParams,
    );

    return result?.maxNum != null ? parseInt(result.maxNum, 10) : 0;
  }

  /**
   * Generates the next sequential code for a given task/ticket space.
   * MUST be called inside a transaction (pass the transaction's EntityManager).
   *
   * Self-corrects if the sequence counter was inflated (e.g. from preview calls
   * that incremented the counter without ever creating a record).
   */
  async generateAndAssignCode(
    manager: EntityManager,
    companyId: number,
    spaceId: number,
    postType: PostType,
    levelPrefix: string | null = null,
    levelSequence: number | null = null,
    parentTaskId: number | null = null,
  ): Promise<string> {
    return manager.transaction(async (txManager) => {
      // Lock the row to prevent concurrent code duplication
      const sequence = await txManager.findOne(PostSequence, {
        where: {
          companyId,
          spaceId,
          postType,
          levelPrefix: levelPrefix === null ? IsNull() : levelPrefix,
          parentTaskId: parentTaskId === null ? IsNull() : parentTaskId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sequence) {
        // No sequence row yet — bootstrap from actual max in the table
        const maxNumber = await this.queryActualMax(
          txManager, companyId, spaceId, postType, levelPrefix, parentTaskId,
        );

        const nextToReturn = maxNumber + 1;
        const newSequence = txManager.create(PostSequence, {
          companyId,
          spaceId,
          postType,
          levelPrefix,
          levelSequence,
          parentTaskId,
          nextNumber: nextToReturn + 1,
          createdBy: 'system',
        });
        await txManager.save(PostSequence, newSequence);
        return levelPrefix ? `${levelPrefix}${nextToReturn}` : `${nextToReturn}`;
      }

      // Self-correct: if the sequence counter was inflated (e.g. from repeated
      // preview calls that never resulted in a task being created), reset it to
      // actualMax + 1 so no numbers are skipped unnecessarily.
      const actualMax = await this.queryActualMax(
        txManager, companyId, spaceId, postType, levelPrefix, parentTaskId,
      );
      const realNext = actualMax + 1;
      if (sequence.nextNumber > realNext) {
        sequence.nextNumber = realNext;
      }

      const currentNumber = sequence.nextNumber;
      const generatedCode = sequence.levelPrefix
        ? `${sequence.levelPrefix}${currentNumber}`
        : `${currentNumber}`;

      sequence.nextNumber += 1;
      await txManager.save(PostSequence, sequence);

      return generatedCode;
    });
  }

  /**
   * Reads the code that WOULD be assigned next WITHOUT incrementing the counter.
   * Always derived from the actual max code in the data table so it is never
   * inflated by preview calls. Use this for form display only.
   */
  async peekNextCode(
    manager: EntityManager,
    companyId: number,
    spaceId: number,
    postType: PostType,
    levelPrefix: string | null = null,
    parentTaskId: number | null = null,
  ): Promise<string> {
    const maxNumber = await this.queryActualMax(
      manager, companyId, spaceId, postType, levelPrefix, parentTaskId,
    );
    return levelPrefix ? `${levelPrefix}${maxNumber + 1}` : `${maxNumber + 1}`;
  }

  /**
   * If a deleted post had the maximum sequence number for its level prefix,
   * decrement the sequence tracker so the number can be reused.
   */
  async reduceSequenceIfMaximum(
    manager: EntityManager,
    companyId: number,
    spaceId: number,
    postType: PostType,
    levelPrefix: string | null,
    deletedCode: string,
    parentTaskId: number | null = null,
  ): Promise<void> {
    return manager.transaction(async (txManager) => {
      const sequence = await txManager.findOne(PostSequence, {
        where: {
          companyId,
          spaceId,
          postType,
          levelPrefix: levelPrefix === null ? IsNull() : levelPrefix,
          parentTaskId: parentTaskId === null ? IsNull() : parentTaskId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sequence) return;

      const match = deletedCode.match(/([0-9]+)$/);
      if (!match) return;

      const deletedNumber = parseInt(match[1], 10);

      if (deletedNumber === sequence.nextNumber - 1) {
        sequence.nextNumber -= 1;
        await txManager.save(PostSequence, sequence);
      }
    });
  }
}
