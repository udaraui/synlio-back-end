import { PrimaryColumn, ViewColumn, ViewEntity } from 'typeorm';
import { ActiveStatus } from '../../../common/enum/status.enum';

@ViewEntity({
  name: 'user_company_view',
  synchronize: process.env.VIEW_SYNCHRONIZE === 'true',
  expression: `
        SELECT  uc."userId" as "userId",
          c."id" as "companyId",
          c."company_code",
          c."company",
          c."logo",
          c."isActive",
          c."createdAt",
          c."updatedAt",
          c."createdBy",
          c."updatedBy",
          (u."defaultCompanyId" = c.id) as "is_default",
          cd."weekStartDate",
          cd."weekEndDate"
          FROM public.user_companies_company as uc
          LEFT JOIN company as c 
          on c.id = uc."companyId"
          LEFT JOIN "user" as u
          on u.id = uc."userId"
          LEFT JOIN (
            SELECT "companyId", id as "calendarId"
            FROM calendar
            WHERE "isActive" = true
          ) cal ON cal."companyId" = c.id
          LEFT JOIN calendar_days cd ON cd."calendarId" = cal."calendarId" AND cd.date = CURRENT_DATE
      `,
})
export class UserCompanyView {
  @ViewColumn()
  @PrimaryColumn()
  userId: number;

  @ViewColumn()
  @PrimaryColumn()
  companyId: number;

  @ViewColumn()
  company_code: string;

  @ViewColumn()
  company: string;

  @ViewColumn()
  logo: string;

  @ViewColumn()
  isActive: ActiveStatus;

  @ViewColumn()
  createdAt: Date;

  @ViewColumn()
  updatedAt: Date;

  @ViewColumn()
  createdBy: string;

  @ViewColumn()
  updatedBy: string;

  @ViewColumn()
  is_default: boolean;

  @ViewColumn()
  weekStartDate: Date;

  @ViewColumn()
  weekEndDate: Date;
}
