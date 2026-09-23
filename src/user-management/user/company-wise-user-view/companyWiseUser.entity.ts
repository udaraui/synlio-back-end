import { PrimaryColumn, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'company_wise_user_view',
  synchronize: process.env.VIEW_SYNCHRONIZE === 'true',
  expression: `
    SELECT DISTINCT ON (u.id)
      u.id,
      uc."companyId",
      u.first_name,
      u.last_name,
      u.email,
      u.mobile_number,
      u.profile_picture,
      u."isActive",
      u."createdAt",
      u."updatedAt"
    FROM public."user" u
    JOIN public.user_companies_company uc
      ON u.id = uc."userId"
    ORDER BY u.id ASC;
  `,
})
export class CompanyWiseUserView {
  @ViewColumn()
  @PrimaryColumn()
  id: number;

  @ViewColumn()
  companyId: number;

  @ViewColumn()
  first_name: string;

  @ViewColumn()
  last_name: string;

  @ViewColumn()
  email: string;

  @ViewColumn()
  mobile_number: string;

  @ViewColumn()
  profile_picture: string;

  @ViewColumn()
  isActive: boolean;

  @ViewColumn()
  createdAt!: Date;

  @ViewColumn()
  updatedAt!: Date;
}
