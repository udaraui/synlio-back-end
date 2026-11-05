import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompanyCrmDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  employee_count?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  manage_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  optional_data?: string;
}

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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  company_type?: string;

  @IsOptional()
  crm?: CompanyCrmDto | string;
}

export class CompleteRegistrationDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  mobile_number?: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  company_name: string;

  @IsOptional()
  @IsString()
  company_address?: string;

  @IsOptional()
  @IsString()
  company_type?: string;

  @IsString()
  @IsNotEmpty()
  registration_token: string;

  @IsOptional()
  crm?: CompanyCrmDto | string;
}

export class OnboardingSetupAdminRoleDto {
  @IsNumber()
  @IsNotEmpty()
  companyId: number;
}
