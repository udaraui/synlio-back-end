import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class OnboardingCreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company_name: string;

  /** Ignored — the company code is auto-generated from the company name. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  company_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  company_address?: string;
}

export class OnboardingSetupAdminRoleDto {
  @IsNumber()
  @IsNotEmpty()
  companyId: number;
}
