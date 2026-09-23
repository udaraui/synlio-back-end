import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'user_privilege_view',
  synchronize: process.env.VIEW_SYNCHRONIZE === 'true',
  expression: `
    select
    ucr."userId",
    ucr."companyId",
    p.id as "privilegeId",
    max(p.privilege) as privilege,
    max(p.access_key) as access_key, 
    max(p.description) as description, 
    max(p.level_type) as level_type
    FROM public.user_company_role as ucr
    left join role_privileges_privilege rpp
    on rpp."roleId" = ucr."roleId" 
    left join privilege p 
    on p.id = rpp."privilegeId"
    where p.id is not null 
    group by ucr."userId" , ucr."companyId" , p.id
    order by ucr."userId" , ucr."companyId" , p.id
  `,
})
export class UserPrivilegeView {
  @ViewColumn()
  userId: number;

  @ViewColumn()
  companyId: number;

  @ViewColumn()
  privilegeId: number;

  @ViewColumn()
  privilege: string;

  @ViewColumn({ name: 'access_key' })
  access_key: string;

  @ViewColumn()
  description: string;

  @ViewColumn()
  level_type: string;
}
