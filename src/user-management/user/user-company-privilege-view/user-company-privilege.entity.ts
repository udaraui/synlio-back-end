import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'user_company_privilege_view',
  synchronize: process.env.VIEW_SYNCHRONIZE === 'true',
  expression: `
    SELECT 
        ucr."userId",
        ucr."companyId",
        STRING_AGG(p."access_key", ',') AS access_key
    FROM public.user_company_role as ucr
    LEFT JOIN public.role_privileges_privilege as rp 
      ON ucr."roleId" = rp."roleId"
    LEFT JOIN public.privilege as p
      ON rp."privilegeId" = p.id
    LEFT JOIN public.company as c
      ON c."id" = ucr."companyId"
    WHERE c."isActive" = 'active'
    GROUP BY ucr."userId", ucr."companyId"
  `,
})
export class UserCompanyPrivilegeView {
  @ViewColumn()
  userId: number;

  @ViewColumn()
  companyId: number;

  @ViewColumn({ name: 'access_key' })
  access_key: string;
}
