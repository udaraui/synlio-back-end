import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserService } from '../user-management/user/user.service';
import { UserPrivilegeView } from '../user-management/user/user-privilege-view/user-privilege.entity';
import { RedisService } from '../redis/redis.service';
import { SYNLIO_LOGO_DATA_URI } from '../common/email/email-template.helper';
import { EmailClient } from '@azure/communication-email';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { Company } from '../company-management/company/company.entity';
import { Role } from '../user-management/role/role.entity';
import { Privilege, PrivilegeLevel } from '../user-management/privilege/privilege.entity';
import { UserCompanyRole } from '../user-management/user/user-company-role.entity';
import { User } from '../user-management/user/user.entity';
import { ActiveStatus } from '../common/enum/status.enum';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserCompanyView } from '../user-management/user/user-company-view/user-company.entity';
import { Division } from '../company-management/division/division.entity';
import { uploadToAzure, uploadToAzureCompanyLogo } from '../common/azure/azure-image-upload';
import { Resource } from '../resource-management/resource/resource.entity';
import { normalizeEmail } from '../common/email/email-normalize.helper';
import { UserRegistrationSource } from 'src/common/enum/user-registration-source.enum';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Verification code lifetime and brute-force limits. */
  private static readonly VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_VERIFICATION_ATTEMPTS = 5;

  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private redisService: RedisService,
    @InjectRepository(UserPrivilegeView)
    private userPrivilegeViewRepository: Repository<UserPrivilegeView>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly authorizationService: AuthorizationService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async checkEmailExists(email: string): Promise<{ exists: boolean }> {
    const exists = await this.usersService.isEmailTaken(email);
    return { exists };
  }

  private async getPrivilegesWithFallback(userId: number): Promise<any[]> {
    const cachedRaw = await this.redisService.get(`user_privileges:${userId}`);
    let privileges = cachedRaw ? JSON.parse(cachedRaw) : null;

    if (!privileges || privileges.length === 0) {
      const dbPrivileges = await this.userPrivilegeViewRepository.find({
        where: { userId },
      });
      const companyMap = new Map<number, number[]>();
      for (const record of dbPrivileges) {
        if (!companyMap.has(record.companyId))
          companyMap.set(record.companyId, []);
        companyMap.get(record.companyId)!.push(record.privilegeId);
      }
      privileges = Array.from(companyMap.entries()).map(
        ([companyId, privilegeIds]) => ({ companyId, privilegeIds }),
      );
      if (privileges.length > 0) {
        await this.redisService.set(
          `user_privileges:${userId}`,
          JSON.stringify(privileges),
        );
      } else {
        privileges = [];
      }
    }
    return privileges;
  }

  async login(user: any) {
    const JWT_secret = process.env.JWT_SECRET || '';
    const JWT_refresh_secret = process.env.JWT_REFRESH_SECRET || '';

    if (!JWT_secret || !JWT_refresh_secret) {
      throw new Error('JWT_SECRET or JWT_REFRESH_SECRET is not set');
    }

    // const cachedRaw = await this.redisService.get(`user_privileges:${user.id}`);
    // const privileges = cachedRaw ? JSON.parse(cachedRaw) : [];
    const privileges = await this.getPrivilegesWithFallback(user.id);

    const payload = {
      userId: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      mobile_number: user.mobile_number,
      privileges,
    };

    const access_token = this.jwtService.sign(payload, {
      secret: JWT_secret,
      expiresIn: '15m',
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: JWT_refresh_secret,
      expiresIn: '7d',
    });

    await this.updateRefreshToken(user.id, refresh_token);

    const return_user = await this.usersService.getUserByIdLoggedIn(user.id);

    return {
      access_token,
      refresh_token,
      return_user,
    };
  }

  async updateRefreshToken(userId: number, refreshToken: string | undefined) {
    const user = await this.usersService.updateRefreshToken(
      userId,
      refreshToken,
    );
    return user;
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || jwtConstants.refresh_secret,
      });
      const userId = payload.userId;
      const user = await this.usersService.getOnlyUserById(userId);
      if (!user || !user.hashedRefreshToken) {
        throw new ForbiddenException('Access Denied');
      }
      const refreshTokenMatches = await bcrypt.compare(
        refreshToken,
        user.hashedRefreshToken,
      );
      if (!refreshTokenMatches) {
        throw new ForbiddenException('Access Denied');
      }
      // const cachedRaw = await this.redisService.get(`user_privileges:${user.id}`);
      // const privileges = cachedRaw ? JSON.parse(cachedRaw) : [];
      const privileges = await this.getPrivilegesWithFallback(user.id);

      const newPayload = {
        userId: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        mobile_number: user.mobile_number,
        privileges,
      };
      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_SECRET || jwtConstants.secret,
        expiresIn: '15m',
      });

      return { access_token: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  verifyToken(token: string, secret: string) {
    return this.jwtService.verify(token, { secret });
  }

  // ─── Email Verification ───────────────────────────────────────────────── //

  /** Cryptographically secure, zero-padded 6-digit code. */
  private generateVerificationCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  /**
   * HMAC-SHA256 of `${email}:${code}` with a server secret.
   * - Email binding keeps the stored hash unique per row.
   * - The secret prevents offline brute force of the 10^6 code space.
   */
  private hashVerificationCode(email: string, code: string): string {
    const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('OTP_HASH_SECRET (or JWT_SECRET) is not set');
    }
    return crypto
      .createHmac('sha256', secret)
      .update(`${normalizeEmail(email)}:${code}`)
      .digest('hex');
  }

  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{
    message: string;
    registration_token: string;
  }> {
    const invalid = 'Invalid or expired verification code';
    const pending = await this.usersService.findPendingByEmail(email);

    if (!pending) {
      throw new BadRequestException(invalid);
    }

    if (
      !pending.expiry ||
      new Date() > pending.expiry
    ) {
      throw new BadRequestException(
        'Verification code has expired. Please register again to get a new code.',
      );
    }

    // Consume an attempt BEFORE comparing so parallel guesses can't exceed the cap
    const max = AuthService.MAX_VERIFICATION_ATTEMPTS;
    const attempts = await this.usersService.consumeVerificationAttempt(
      pending.id,
      max,
    );
    if (attempts === null) {
      throw new BadRequestException(
        'Too many incorrect attempts. Please register again to get a new code.',
      );
    }

    const expected = Buffer.from(this.hashVerificationCode(pending.email, code), 'hex');
    const stored = Buffer.from(pending.hashed_otp, 'hex');
    const matches =
      expected.length === stored.length && crypto.timingSafeEqual(expected, stored);

    if (!matches) {
      const remaining = max - attempts;
      throw new BadRequestException(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please register again to get a new code.',
      );
    }

    // Delete the temporary row since verification succeeded
    await this.usersService.deletePendingRegistration(pending.id);

    const payload = { email: pending.email, isRegistration: true };
    const registration_token = this.jwtService.sign(payload, { expiresIn: '30m' });

    return {
      message: 'Email verified successfully',
      registration_token,
    };
  }

  // ─── Self-Registration ─────────────────────────────────────────────────── //

  async register(
    email: string,
  ): Promise<{ message: string }> {
    const rawCode = this.generateVerificationCode();
    console.log(`[DEV ONLY] OTP Code for ${email}: ${rawCode}`);
    const hashedCode = this.hashVerificationCode(email, rawCode);

    const expiry = new Date(Date.now() + AuthService.VERIFICATION_CODE_TTL_MS);

    let pending;
    try {
      pending = await this.usersService.createPendingRegistration(
        email,
        hashedCode,
        expiry,
      );
    } catch (err: any) {
      if (err?.message === 'EMAIL_ALREADY_EXISTS') {
        throw new BadRequestException('Email already exists. Please log in or use forgot password if you have forgotten your password.');
      }
      throw err;
    }

    try {
      await this.sendVerificationEmail(pending.email, rawCode);
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${pending.email}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return {
      message:
        'Registration successful. Please check your email for your verification code.',
    };
  }

  // ─── Forgot / Reset Password ─────────────────────────────────────────── //

  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'If an account with that email exists, a password reset link has been sent',
    };

    // Find the active user — return generic response even if not found
    // (prevents email enumeration attacks)
    const user = await this.usersService.findOneByEmailInsensitive(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found.`);
    }

    // Generate a cryptographically secure random token (raw, sent in email link)
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Hash with SHA-256 for DB storage — allows direct lookup without bcrypt
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Store hash + 1-hour expiry on the user record
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    await this.usersService.setPasswordResetToken(user.id!, hashedToken, expiry);

    // Build reset link and dispatch the email (remove trailing slash if present)
    const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const frontendUrl = rawFrontendUrl.replace(/\/+$/, '');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await this.sendPasswordResetEmail(user.email, resetLink, user.first_name);
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}`,
        err instanceof Error ? err.stack : String(err),
      );
      // Do not expose send failures — still return generic success
    }

    return genericResponse;
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Hash the incoming raw token to match the stored SHA-256 hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (
      !user.passwordResetTokenExpiry ||
      new Date() > user.passwordResetTokenExpiry
    ) {
      throw new BadRequestException(
        'Password reset token has expired. Please request a new one',
      );
    }

    await this.usersService.resetPasswordByToken(user.id!, newPassword);

    return { message: 'Password reset' };
  }

  private async sendVerificationEmail(
    toEmail: string,
    verificationCode: string,
  ): Promise<void> {
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    const senderEmail = process.env.AZURE_COMMUNICATION_SENDER_EMAIL;

    if (!connectionString || !senderEmail) {
      throw new Error('Azure Communication Services credentials are not configured');
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Verify your Synlio account</title>
          <style>
            body, .email-bg { background-color:#ffffff; }
            @media (prefers-color-scheme: dark) {
              body, .email-bg { background-color:#0b1220 !important; }
            }
            [data-ogsc] body, [data-ogsc] .email-bg { background-color:#0b1220 !important; }
          </style>
        </head>
        <body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:#ffffff;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background-color:#0f172a;padding:28px 40px;text-align:center;">
                      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td style="vertical-align:middle;padding-right:10px;">
                            <img src="${SYNLIO_LOGO_DATA_URI}" alt="Synlio" width="28" height="28" style="display:block;"/>
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="color:#f3f4f6;font-size:15px;font-weight:600;letter-spacing:.08em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Synlio</span>
                          </td>
                        </tr>
                      </table>
                      <div style="color:#94a3b8;font-size:13px;margin-top:10px;letter-spacing:.5px;">
                        Email Verification
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="margin:0 0 16px;color:#1a202c;font-size:20px;font-weight:600;">Verify your email address</h2>
                      <p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.6;">Hi,</p>
                      <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.6;">
                        Thanks for signing up for Synlio! Enter the code below to verify your email address.
                        This code will expire in <strong>15 minutes</strong>.
                      </p>
                      <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                        <tr>
                          <td style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:16px 28px;text-align:center;">
                            <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#0f172a;">${verificationCode}</span>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 24px;color:#718096;font-size:13px;line-height:1.6;">
                        For your security, never share this code with anyone. Synlio will never ask you for it.
                      </p>
                      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
                      <p style="margin:0;color:#a0aec0;font-size:12px;line-height:1.6;">
                        If you didn't create a Synlio account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;background:#f7fafc;text-align:center;">
                      <p style="margin:0;color:#a0aec0;font-size:12px;">
                        &copy; ${new Date().getFullYear()} Synlio. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `Your Synlio verification code is ${verificationCode}. It expires in 15 minutes. Never share this code with anyone.`;

    const emailClient = new EmailClient(connectionString);
    const poller = await emailClient.beginSend({
      senderAddress: senderEmail,
      content: {
        subject: `${verificationCode} is your Synlio verification code`,
        html,
        plainText: text,
      },
      recipients: {
        to: [{ address: toEmail }],
      },
    });

    await poller.pollUntilDone();
    this.logger.log(`Verification email sent to ${toEmail}`);
  }

  private async sendPasswordResetEmail(
    toEmail: string,
    resetLink: string,
    firstName: string,
  ): Promise<void> {
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    const senderEmail = process.env.AZURE_COMMUNICATION_SENDER_EMAIL;

    if (!connectionString || !senderEmail) {
      throw new Error('Azure Communication Services credentials are not configured');
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="color-scheme" content="light dark" />
          <meta name="supported-color-schemes" content="light dark" />
          <title>Reset Your Password</title>
          <style>
            body, .email-bg { background-color:#ffffff; }
            @media (prefers-color-scheme: dark) {
              body, .email-bg { background-color:#0b1220 !important; }
            }
            [data-ogsc] body, [data-ogsc] .email-bg { background-color:#0b1220 !important; }
          </style>
        </head>
        <body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background-color:#ffffff;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background-color:#0f172a;padding:28px 40px;text-align:center;">
                      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td style="vertical-align:middle;padding-right:10px;">
                            <img src="${SYNLIO_LOGO_DATA_URI}" alt="Synlio" width="28" height="28" style="display:block;"/>
                          </td>
                          <td style="vertical-align:middle;">
                            <span style="color:#f3f4f6;font-size:15px;font-weight:600;letter-spacing:.08em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">Synlio</span>
                          </td>
                        </tr>
                      </table>
                      <div style="color:#94a3b8;font-size:13px;margin-top:10px;letter-spacing:.5px;">
                        Password Reset
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="margin:0 0 16px;color:#1a202c;font-size:20px;font-weight:600;">Reset Your Password</h2>
                      <p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.6;">Hi ${firstName},</p>
                      <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.6;">
                        We received a request to reset the password for your Synlio account.
                        Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.
                      </p>
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                        <tr>
                          <td style="background:#5b9bd5;border-radius:8px;">
                            <a href="${resetLink}" target="_blank"
                               style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;color:#718096;font-size:13px;line-height:1.6;">
                        If the button doesn't work, copy and paste this link into your browser:
                      </p>
                      <p style="margin:0 0 24px;word-break:break-all;">
                        <a href="${resetLink}" style="color:#5b9bd5;font-size:13px;">${resetLink}</a>
                      </p>
                      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
                      <p style="margin:0;color:#a0aec0;font-size:12px;line-height:1.6;">
                        If you didn't request a password reset, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;background:#f7fafc;text-align:center;">
                      <p style="margin:0;color:#a0aec0;font-size:12px;">
                        &copy; ${new Date().getFullYear()} Synlio. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `Hi ${firstName}, reset your Synlio password here (expires in 1 hour): ${resetLink}`;

    const emailClient = new EmailClient(connectionString);
    const poller = await emailClient.beginSend({
      senderAddress: senderEmail,
      content: {
        subject: 'Reset Your Synlio Password',
        html,
        plainText: text,
      },
      recipients: {
        to: [{ address: toEmail }],
      },
    });

    await poller.pollUntilDone();

    this.logger.log(`Password reset email sent to ${toEmail}`);
  }

  // ─── Complete Registration ────────────────────────────────────────── //

  async completeRegistration(
    dto: any,
    userProfilePicture?: Express.Multer.File,
    companyProfilePicture?: Express.Multer.File
  ): Promise<any> {
    // 1. Verify token
    let payload;
    try {
      payload = this.jwtService.verify(dto.registration_token);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired registration token');
    }

    if (!payload.isRegistration || payload.email !== dto.email) {
      throw new UnauthorizedException('Token does not match registration email');
    }

    // 2. Create User
    const createUserDto = {
      email: dto.email,
      password: dto.password,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone_number: dto.mobile_number,
      isActive: true,
      registrationSource: UserRegistrationSource.SELF_REGISTERED,
    };

    const user = await this.usersService.createUser(
      createUserDto as any,
      { email: dto.email }, // authUser stub
      userProfilePicture,
      undefined
    );

    // 3. Create Company
    const companyRes = await this.onboardingCreateCompany(
      dto.company_name,
      dto.company_code,
      { email: user.email, userId: user.id },
      companyProfilePicture
    );

    if (dto.company_address) {
      await this.entityManager.update(Company, companyRes.companyId, { address: dto.company_address });
    }

    // 4. Setup Admin Role
    const loginResult = await this.onboardingSetupAdminRole(
      companyRes.companyId,
      { email: user.email, userId: user.id }
    );

    return loginResult;
  }

  // ─── Onboarding ───────────────────────────────────────────────── //

  /**
   * Step 1 — Create company for a self-registered user.
   * `is_self_registered_company` is ALWAYS set to `true` here; the client cannot override it.
   */
  async onboardingCreateCompany(
    company_name: string,
    company_code: string,
    authUser: any,
    companyProfilePicture?: Express.Multer.File
  ): Promise<{ companyId: number; message: string }> {


    // 2. Create the company with is_self_registered_company always true
    const company = this.entityManager.create(Company, {
      company: company_name,
      company_code,
      is_self_registered_company: true, // server-enforced
      isActive: ActiveStatus.ACTIVE,
      createdBy: authUser.email,
    });

    let saved = await this.entityManager.save(Company, company);

    // 3. Upload Company Profile Picture
    if (companyProfilePicture) {
      const companyImageUrl = await uploadToAzureCompanyLogo(companyProfilePicture, saved.id as number);
      saved.logo = companyImageUrl;
      saved = await this.entityManager.save(Company, saved);
    }

    // Link the user to this company
    await this.entityManager
      .createQueryBuilder()
      .relation(User, 'companies')
      .of(authUser.userId)
      .add(saved.id);

    // Set as default company
    await this.entityManager.update(User, authUser.userId, {
      defaultCompanyId: saved.id as number,
    });

    // Sync company cache for the user
    try {
      const userCompanies = await this.entityManager.find(UserCompanyView, {
        where: { userId: authUser.userId },
      });
      await this.redisService.setUserCompanies(authUser.userId, userCompanies);
    } catch (err) {
      this.logger.warn(`Cache sync failed after onboarding company creation: ${err}`);
    }

    return {
      companyId: saved.id as number,
      message: 'Company created successfully',
    };
  }

  /**
   * Step 2 — Create Admin role with all DATA & CONFIG privileges and assign to the requesting user.
   */
  async onboardingSetupAdminRole(
    companyId: number,
    authUser: any,
  ): Promise<{ message: string; access_token: string; refresh_token: string; return_user: any }> {
    // Verify company exists and belongs to this user (was just created by them)
    const company = await this.entityManager.findOne(Company, {
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company with id ${companyId} not found`);
    }

    // Fetch all DATA and CONFIG level privileges
    const privileges = await this.entityManager.find(Privilege, {
      where: [
        { level_type: PrivilegeLevel.DATA },
        { level_type: PrivilegeLevel.CONFIG },
      ],
    });

    // Create the Admin role for this company
    const adminRole = this.entityManager.create(Role, {
      role: 'Admin',
      companyId,
      company,
      isActive: true,
      createdBy: authUser.email,
      privileges,
    });

    const savedRole = await this.entityManager.save(Role, adminRole);

    // Assign the Admin role to the requesting user for this company
    const userCompanyRole = this.entityManager.create(UserCompanyRole, {
      userId: authUser.userId,
      companyId,
      roleId: savedRole.id as number,
    });
    await this.entityManager.save(UserCompanyRole, userCompanyRole);

    // Create a default Division for this company
    const defaultDivision = this.entityManager.create(Division, {
      division: 'Default',
      division_code: 'DEFAULT',
      companyId,
      isActive: true,
      createdBy: authUser.email,
    });
    const savedDivision = await this.entityManager.save(Division, defaultDivision);

    // Assign the default division to the requesting user
    // Since division.users is a ManyToMany relationship in TypeORM, we can use QueryBuilder relation
    await this.entityManager
      .createQueryBuilder()
      .relation(Division, 'users')
      .of(savedDivision.id)
      .add(authUser.userId);

    // Create a corresponding Resource record for the authenticated user
    const fullUser = await this.entityManager.findOne(User, {
      where: { id: authUser.userId }
    });

    if (fullUser) {
      const resource = this.entityManager.create(Resource, {
        first_name: fullUser.first_name,
        last_name: fullUser.last_name,
        email: fullUser.email,
        userId: fullUser.id,
        mobile: fullUser.mobile_number || undefined,
        working_hours: 8,
        companyId: companyId,
        divisionId: savedDivision.id as number,
        profile_pic: fullUser.profile_picture,
        active_status: true,
        createdBy: authUser.email,
      });
      await this.entityManager.save(Resource, resource);
    }

    // Refresh auth caches
    try {
      await this.authorizationService.updateUserCompanyPrivilegesIntoCache(authUser.userId);
      const userCompanies = await this.entityManager.find(UserCompanyView, {
        where: { userId: authUser.userId },
      });
      await this.redisService.setUserCompanies(authUser.userId, userCompanies);
    } catch (err) {
      this.logger.warn(`Cache refresh failed after onboarding admin role setup: ${err}`);
    }

    // Generate new tokens that include the new privileges
    const user = await this.usersService.getOnlyUserById(authUser.userId);
    const loginResult = await this.login(user);

    return {
      message: 'Admin role created and assigned successfully',
      ...loginResult
    };
  }
}
