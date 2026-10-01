import { IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class OnboardingCreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  company_code: string;
}

export class OnboardingSetupAdminRoleDto {
  @IsNumber()
  @IsNotEmpty()
  companyId: number;
}
