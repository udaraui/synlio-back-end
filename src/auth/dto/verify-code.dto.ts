import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({
    description: 'Email address used during registration',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: '6-digit verification code sent to the email',
    example: '482913',
  })
  @Matches(/^\d{6}$/, { message: 'Verification code must be 6 digits' })
  code: string;
}
