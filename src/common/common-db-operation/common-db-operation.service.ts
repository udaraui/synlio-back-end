import { HttpException, Injectable } from '@nestjs/common';
import { EntityManager, ObjectLiteral, In } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { QueryParam } from './common-db-operation-query-param.dto';
import { log } from 'console';

@Injectable()
export class CommonDbOperationService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) { }

  async get(entity: string, entityId: number): Promise<ObjectLiteral | null> {
    const found = await this.entityManager.findOneBy(entity as any, {
      id: entityId,
    });

    if (!found) {
      throw new HttpException(`Sorry, the id doesn't exist`, 404);
    }
    return found;
  }

  async search(
    entity: string,
    param: QueryParam,
  ): Promise<{ total: number; data: object[] }> {
    let total = 0;
    let data: ObjectLiteral[] = [];

    // console.log('------------', param);

    const { first, rows, multiSorts, filters, withRelations } = param;
    let query = this.entityManager
      .getRepository(entity)
      .createQueryBuilder('entity');

    // ...existing code (filters)...

    filters?.forEach((fl) => {
      // These matchModes don't require a value – handle them first
      if (fl.matchMode === 'is-null') {
        query = query.andWhere(`entity.${fl.field} IS NULL`);
        return;
      }
      if (fl.matchMode === 'not-null') {
        query = query.andWhere(`entity.${fl.field} IS NOT NULL`);
        return;
      }

      if (fl?.value !== undefined && fl?.value !== null && fl?.value !== '') {
        const paramKey = `${fl.field}_${Math.random()
          .toString(36)
          .substring(2, 8)}`;

        if (fl.matchMode === 'startsWith') {
          query = query.andWhere(`entity.${fl.field} ILIKE :${paramKey}`, {
            [paramKey]: `${fl.value}%`,
          });
        } else if (fl.matchMode === 'endsWith') {
          query = query.andWhere(`entity.${fl.field} ILIKE :${paramKey}`, {
            [paramKey]: `%${fl.value}`,
          });
        } else if (fl.matchMode === 'contains') {
          query = query.andWhere(`entity.${fl.field} ILIKE :${paramKey}`, {
            [paramKey]: `%${fl.value}%`,
          });
        } else if (fl.matchMode === 'notContains') {
          query = query.andWhere(`entity.${fl.field} NOT ILIKE :${paramKey}`, {
            [paramKey]: `%${fl.value}%`,
          });
        } else if (fl.matchMode === 'equals') {
          query = query.andWhere(`entity.${fl.field} = :${paramKey}`, {
            [paramKey]: fl.value.toString().trim(),
          });
        } else if (fl.matchMode === 'notEquals') {
          query = query.andWhere(`entity.${fl.field} <> :${paramKey}`, {
            [paramKey]: fl.value.toString().trim(),
          });
        } else if (fl.matchMode === 'equal-trim') {
          query = query.andWhere(`TRIM(entity.${fl.field}) = :${paramKey}`, {
            [paramKey]: fl.value.toString().trim(),
          });
        } else if (fl.matchMode === 'in' || fl.matchMode === 'list') {
          // OLD CODE (Very slow for large arrays due to TypeORM parameter expansion overhead):
          // query = query.andWhere(`entity.${fl.field} IN (:...${paramKey})`, {
          //   [paramKey]: fl.value,
          // });
          
          const valArray = Array.isArray(fl.value) ? fl.value : [fl.value];
          if (valArray.length === 0) {
            query = query.andWhere('1 = 0'); // Empty IN always false
          } else {
            // NEW CODE: Use Postgres native ANY() to bypass TypeORM's extremely slow parameter expansion (:...param)
            // which can take several seconds to parse for large arrays (e.g., 5000+ task IDs).
            query = query.andWhere(`entity.${fl.field} = ANY(:${paramKey})`, {
              [paramKey]: valArray,
            });
          }
        } else if (fl.matchMode === 'null') {
          query = query.andWhere(`COALESCE(entity.${fl.field}, '') = ''`);
        } else if (fl.matchMode === 'null-0') {
          query = query.andWhere(`COALESCE(entity.${fl.field}, '0') = '0'`);
        } else if (
          fl.matchMode &&
          ['>', '<', '>=', '<='].includes(fl.matchMode)
        ) {
          query = query.andWhere(
            `entity.${fl.field} ${fl.matchMode} :${paramKey}`,
            { [paramKey]: fl.value.toString() },
          );
        } else if (fl.matchMode === 'date') {
          query = query.andWhere(
            `entity.${fl.field} BETWEEN :startDate AND :endDate`,
            {
              startDate: `${fl.value}T00:00:00.000000`,
              endDate: `${fl.value}T23:59:59.999999`,
            },
          );
        } else if (fl.matchMode === 'dateIs') {
          const date1 = new Date(fl.value).toISOString().split('T')[0];
          query = query.andWhere(`DATE(entity.${fl.field}) = :${paramKey}`, {
            [paramKey]: date1,
          });
        } else if (fl.matchMode === 'dateIsNot') {
          const date1 = new Date(fl.value).toISOString().split('T')[0];
          query = query.andWhere(`DATE(entity.${fl.field}) <> :${paramKey}`, {
            [paramKey]: date1,
          });
        } else if (fl.matchMode === 'dateBefore') {
          const date1 = new Date(fl.value).toISOString().split('T')[0];
          query = query.andWhere(`DATE(entity.${fl.field}) < :${paramKey}`, {
            [paramKey]: date1,
          });
        } else if (fl.matchMode === 'dateAfter') {
          const date1 = new Date(fl.value).toISOString().split('T')[0];
          query = query.andWhere(`DATE(entity.${fl.field}) > :${paramKey}`, {
            [paramKey]: date1,
          });
        } else if (fl.matchMode === 'dateBetween') {
          // Ensure the value is an array with exactly two items
          if (Array.isArray(fl.value) && fl.value.length === 2) {
            const startDate = new Date(fl.value[0]).toISOString().split('T')[0];
            const endDate = new Date(fl.value[1]).toISOString().split('T')[0];

            query = query.andWhere(
              `DATE(entity.${fl.field}) BETWEEN :${paramKey}_start AND :${paramKey}_end`,
              {
                [`${paramKey}_start`]: startDate,
                [`${paramKey}_end`]: endDate,
              },
            );
          }
        } else if (fl.matchMode === 'relation-in') {
          // Filter by a many-to-many join table.
          // value: { joinTable: string, ownerColumn: string, filterColumn: string, ids: number[] }
          // Example: filter tasks where any co-assignee resourceId is in the provided list.
          // Generates: entity.id IN (SELECT "ownerColumn" FROM "joinTable" WHERE "filterColumn" IN (...ids))
          const relValue = fl.value as {
            joinTable: string;
            ownerColumn: string;
            filterColumn: string;
            ids: number[];
          };
          if (
            relValue &&
            Array.isArray(relValue.ids) &&
            relValue.ids.length > 0
          ) {
            // Basic identifier sanitization – only allow word characters and dots
            const sanitise = (s: string) => s.replace(/[^\w.]/g, '');
            const joinTable = sanitise(relValue.joinTable);
            const ownerColumn = sanitise(relValue.ownerColumn);
            const filterColumn = sanitise(relValue.filterColumn);
            query = query.andWhere(
              `entity.id IN (SELECT "${ownerColumn}" FROM "${joinTable}" WHERE "${filterColumn}" IN (:...${paramKey}))`,
              { [paramKey]: relValue.ids },
            );
          }
        }
      }
    });

    // Start count query BEFORE adding joins and sorting
    const countPromise = query.clone().getCount();

    // Eagerly load ManyToOne relations via LEFT JOIN for DATA only
    withRelations?.forEach((rel) => {
      query = query.leftJoinAndSelect(`entity.${rel}`, rel);
    });

    if (multiSorts) {
      multiSorts.forEach((ms) => {
        query = query.addOrderBy(
          `entity.${ms.field}`,
          +ms.order === -1 ? 'DESC' : 'ASC',
        );
      });
    }

    query = query.offset(first ? +first : 0).limit(rows ? +rows : 1000);

    const dataPromise = query.getMany();

    const [totalCount, resultData] = await Promise.all([countPromise, dataPromise]);
    total = totalCount;
    data = resultData;

    // console.log('+++++++++++++++++', data);

    return { total, data };
  }
}
