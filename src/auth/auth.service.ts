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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private redisService: RedisService,
    @InjectRepository(UserPrivilegeView)
    private userPrivilegeViewRepository: Repository<UserPrivilegeView>,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
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
}
