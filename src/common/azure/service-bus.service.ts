import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  ServiceBusClient,
  ServiceBusSender,
  ServiceBusReceiver,
} from '@azure/service-bus';
import * as nodemailer from 'nodemailer';
import { Email } from '../../alert/email/email.entity';
import { Notification } from '../../alert/notification/notification.entity';
import { TicketSpace } from '../../ticket-management/ticket-space/ticket-space.entity';
import { TaskSpace } from '../../task-management/task-space/task-space.entity';
import { Company } from '../../company-management/company/company.entity';
import { EmailProvider } from '../enum/email-provider.enum';
import { WebPubSubService } from './web-pubsub.service';

// ── Message shapes ─────────────────────────────────────────────────────────
type EmailMessage = { type: 'email'; id: number };
type NotificationMessage = { type: 'notification'; id: number };
type QueueMessage = EmailMessage | NotificationMessage;
// ──────────────────────────────────────────────────────────────────────────

/** Maximum allowed email payload — 40 MB */
const MAX_EMAIL_SIZE_BYTES = 40 * 1024 * 1024;

@Injectable()
export class ServiceBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceBusService.name);

  private client: ServiceBusClient;
  private sender: ServiceBusSender;
  private receiver: ServiceBusReceiver;
  private queueName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly webPubSubService: WebPubSubService,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) { }

  // ------------------------------------------------------------------ //
  //  Lifecycle
  // ------------------------------------------------------------------ //

  onModuleInit(): void {
    const connectionString = this.configService.getOrThrow<string>(
      'AZURE_SERVICE_BUS_CONNECTION_STRING',
    );
    this.queueName = this.configService.get<string>(
      'AZURE_SERVICE_BUS_QUEUE_NAME',
      'notificationqueue',
    );

    this.client = new ServiceBusClient(connectionString);
    this.sender = this.client.createSender(this.queueName);
    this.receiver = this.client.createReceiver(this.queueName);

    this.receiver.subscribe(
      {
        processMessage: async (message) => {
          // Always explicitly settle the message so the SDK never tries to
          // auto-complete/abandon on top of our manual call (Bug: double-settle).
          try {
            const body = message.body as QueueMessage;

            if (body.type === 'email') {
              await this.processEmailMessage(body.id);
            } else if (body.type === 'notification') {
              await this.processNotificationMessage(body.id);
            } else {
              this.logger.warn(
                `Unknown message type — body: ${JSON.stringify(body)}`,
              );
            }

            await this.receiver.completeMessage(message);
          } catch (err) {
            this.logger.error(
              `Message processing failed — abandoning for retry`,
              err instanceof Error ? err.stack : String(err),
            );
            try {
              await this.receiver.abandonMessage(message);
            } catch (abandonErr) {
              this.logger.error(
                `Failed to abandon message after processing error`,
                abandonErr,
              );
            }
          }
        },
        processError: (args) => {
          const err = args.error as any;
          const isNetworkError =
            err?.code === 'GeneralError' &&
            (err?.errno === -3008 || // ENOTFOUND
              err?.errno === -4077 || // ECONNREFUSED
              err?.errno === -4078); // ECONNRESET

          if (isNetworkError) {
            // DNS/network failure — log once as WARN, not ERROR (infrastructure issue, not a bug)
            this.logger.warn(
              `Service Bus unreachable (${args.errorSource}): ${err?.message ?? String(args.error)} — check network/VPN connectivity to Azure`,
            );
          } else {
            this.logger.error(
              `Service Bus error — source: ${args.errorSource}`,
              args.error,
            );
          }
          return Promise.resolve();
        },
      },
      // Disable auto-settlement — we call completeMessage / abandonMessage explicitly above.
      { autoCompleteMessages: false },
    );

    this.logger.log(`Azure Service Bus initialised — queue: ${this.queueName}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.receiver?.close();
    await this.sender?.close();
    await this.client?.close();
  }

  // ------------------------------------------------------------------ //
  //  Producers
  // ------------------------------------------------------------------ //

  async sendEmailJob(emailId: number): Promise<void> {
    const body: EmailMessage = { type: 'email', id: emailId };
    await this.sender.sendMessages({ body, contentType: 'application/json' });
    this.logger.log(`Email job enqueued — emailId: ${emailId}`);
  }

  async sendNotificationJob(notificationId: number): Promise<void> {
    const body: NotificationMessage = {
      type: 'notification',
      id: notificationId,
    };
    await this.sender.sendMessages({ body, contentType: 'application/json' });
    this.logger.log(
      `Notification job enqueued — notificationId: ${notificationId}`,
    );
  }

  // ------------------------------------------------------------------ //
  //  Consumer — Email
  // ------------------------------------------------------------------ //

  private async processEmailMessage(emailId: number): Promise<void> {
    this.logger.log(`Processing email — emailId: ${emailId}`);

    const email = await this.entityManager.findOne(Email, {
      where: { id: emailId },
      relations: ['attachments'],
    });

    if (!email) {
      this.logger.warn(`Email record not found — emailId: ${emailId}`);
      return;
    }

    // ── Size guard: reject emails that exceed 40 MB ───────────────────── //
    const payloadSize = Buffer.byteLength(
      (email.subject ?? '') + (email.description ?? '') + (email.to ?? ''),
      'utf8',
    );
    if (payloadSize > MAX_EMAIL_SIZE_BYTES) {
      const sizeMb = (payloadSize / 1024 / 1024).toFixed(2);
      this.logger.warn(
        `Email ${emailId} exceeds 40 MB limit (${sizeMb} MB) — skipping send`,
      );
      await this.entityManager.transaction(async (manager) => {
        email.isError = true;
        email.errorText = `Email size ${sizeMb} MB exceeds the 40 MB limit`;
        await manager.save(email);
      });
      return;
    }

    try {
      // 1. In-app WebSocket notification — emitted first, independent of SMTP
      if (email.userId) {
        this.webPubSubService.sendToUser(email.userId, 'new_email', {
          id: email.id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          description: email.description,
          companyId: email.companyId,
          createdAt: email.createdAt,
        });
      }

      // Guard: TO field must not be empty — if it is, flag as error rather
      // than silently marking the record as "sent" without any SMTP delivery.
      if (!email.to?.trim()) {
        this.logger.warn(
          `Email ${emailId} has an empty TO field — marking as error, no SMTP attempt made`,
        );
        await this.entityManager.transaction(async (manager) => {
          email.isError = true;
          email.errorText = 'Empty TO recipient field — email was never sent';
          await manager.save(email);
        });
        return;
      }

      // 2. Send real email if the space or company has SMTP / mail-service config
      if ((email.spaceId || email.companyId) && email.to) {
        type SmtpConfig = {
          notificationEmail: string;
          emailProvider: EmailProvider;
          notificationEmailPassword: string;
        };

        let smtpConfig: SmtpConfig | null = null;

        const loadSmtpFromCompany = async (
          companyId: number,
        ): Promise<SmtpConfig | null> => {
          const company = await this.entityManager
            .createQueryBuilder(Company, 'c')
            .select([
              'c.id',
              'c.company',
              'c.notificationEmail',
              'c.emailProvider',
            ])
            .addSelect('c.notificationEmailPassword')
            .where('c.id = :id', { id: companyId })
            .getOne();

          if (!company) {
            this.logger.warn(
              `   SMTP CONFIG MISSING — company ID ${companyId} not found in the database.\n` +
              `   No email will be sent for emailId: ${emailId}`,
            );
            return null;
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const companyName = ((company as any)?.company as string) ?? '';
          const companyLabel = `"${companyName}" (ID: ${companyId})`;
          const missing: string[] = [];

          if (!company.notificationEmail) {
            missing.push('notificationEmail  (sender email address)');
          }
          if (!company.emailProvider) {
            missing.push('emailProvider      (gmail | outlook | mail_service)');
          }
          if (!company.notificationEmailPassword) {
            missing.push(
              'notificationEmailPassword  (SMTP password / API key)',
            );
          }
          if (missing.length > 0) {
            this.logger.warn(
              `SMTP CONFIG MISSING — company ${companyLabel} has not configured the following email fields:\n` +
              missing.map((f) => `   • ${f}`).join('\n') +
              '\n' +
              `   Go to Company Settings → Notification Email to set these values.\n` +
              `   No email will be sent for emailId: ${emailId}`,
            );
            return null;
          }

          return company as unknown as SmtpConfig;
        };

        const loadTaskSpaceCompanyId = async (
          spaceId: number,
        ): Promise<number | null> => {
          const ts = await this.entityManager.findOne(TaskSpace, {
            where: { id: spaceId },
            select: ['id', 'companyId'],
          });
          return ts?.companyId ?? null;
        };

        const loadTicketSpaceCompanyId = async (
          spaceId: number,
        ): Promise<number | null> => {
          const tks = await this.entityManager.findOne(TicketSpace, {
            where: { id: spaceId },
            select: ['id', 'companyId'],
          });
          return tks?.companyId ?? null;
        };

        if (email.referenceType === 'task') {
          const companyId = await loadTaskSpaceCompanyId(email.spaceId);
          if (companyId) {
            smtpConfig = await loadSmtpFromCompany(companyId);
          } else {
            this.logger.warn(
              `SMTP config: project space ${email.spaceId} has no associated company — no email will be sent for emailId: ${emailId}`,
            );
          }
        } else if (email.referenceType === 'ticket') {
          const companyId = await loadTicketSpaceCompanyId(email.spaceId);
          if (companyId) {
            smtpConfig = await loadSmtpFromCompany(companyId);
          } else {
            this.logger.warn(
              `SMTP config: ticket space ${email.spaceId} has no associated company — no email will be sent for emailId: ${emailId}`,
            );
          }
        } else {
          // referenceType is null (e.g. TASK_DELETED / TICKET_DELETED audit rows).
          // Infer the space type from keywords in the email subject.
          const subjectLower = (email.subject ?? '').toLowerCase();
          const isTaskSubject = subjectLower.includes('task');
          const isTicketSubject = subjectLower.includes('ticket');

          if (isTaskSubject) {
            const companyId = await loadTaskSpaceCompanyId(email.spaceId);
            if (companyId) {
              smtpConfig = await loadSmtpFromCompany(companyId);
            } else {
              this.logger.warn(
                `SMTP config: project space ${email.spaceId} has no associated company — no email will be sent for emailId: ${emailId}`,
              );
            }
          } else if (isTicketSubject) {
            const companyId = await loadTicketSpaceCompanyId(email.spaceId);
            if (companyId) {
              smtpConfig = await loadSmtpFromCompany(companyId);
            } else {
              this.logger.warn(
                `SMTP config: ticket space ${email.spaceId} has no associated company — no email will be sent for emailId: ${emailId}`,
              );
            }
          } else if (email.companyId) {
            // Direct company lookup fallback for generic emails (e.g. Pulse)
            smtpConfig = await loadSmtpFromCompany(email.companyId);
          } else {
            this.logger.warn(
              `Email ${emailId} has no referenceType, no recognisable type keyword in subject, and no companyId — cannot resolve SMTP config`,
            );
          }
        }

        if (smtpConfig) {
          if (smtpConfig.emailProvider === EmailProvider.MAIL_SERVICE) {
            // ── External HTTP mail service ──────────────────────────── //
            await this.sendViaMailService(
              smtpConfig.notificationEmailPassword, // API key stored here
              email.to,
              email.ccTo ?? undefined,
              email.subject ?? '(no subject)',
              email.description ?? '',
            );
          } else {
            // ── SMTP via Nodemailer (Gmail / Outlook) ───────────────── //
            const transporter = this.buildTransporter(
              smtpConfig.emailProvider,
              smtpConfig.notificationEmail,
              smtpConfig.notificationEmailPassword,
            );

            await transporter.sendMail({
              from: smtpConfig.notificationEmail,
              to: email.to,
              cc: email.ccTo ?? undefined,
              subject: email.subject ?? '(no subject)',
              html: email.description ?? '',
            });
          }

          this.logger.log(
            `Email sent via ${smtpConfig.emailProvider} — to: ${email.to}`,
          );
        } else {
          this.logger.warn(
            `Space ${email.spaceId} (${email.referenceType ?? 'unknown'}) has no SMTP config — skipping real email send`,
          );
        }
      }

      // 3. Mark as sent
      await this.entityManager.transaction(async (manager) => {
        email.isSent = true;
        email.isError = false;
        email.errorText = null as unknown as string;
        await manager.save(email);
      });

      this.logger.log(`Email dispatched — emailId: ${emailId}`);
    } catch (err) {
      await this.entityManager.transaction(async (manager) => {
        email.isError = true;
        email.errorText = err instanceof Error ? err.message : String(err);
        await manager.save(email);
      });

      this.logger.error(
        `Failed to dispatch email — emailId: ${emailId}`,
        err instanceof Error ? err.stack : undefined,
      );

      throw err;
    }
  }

  // ------------------------------------------------------------------ //
  //  Consumer — Notification
  // ------------------------------------------------------------------ //

  private async processNotificationMessage(
    notificationId: number,
  ): Promise<void> {
    this.logger.log(
      `Processing notification — notificationId: ${notificationId}`,
    );

    const notification = await this.entityManager.findOne(Notification, {
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.warn(
        `Notification record not found — notificationId: ${notificationId}`,
      );
      return;
    }

    try {
      // 1. In-app notification via Azure Web PubSub — fire-and-forget; must not crash handler
      if (notification.userId) {
        this.webPubSubService.sendToUser(
          notification.userId,
          'new_notification',
          {
            id: notification.id,
            title: notification.title,
            description: notification.description,
            from: notification.from,
            createdAt: notification.createdAt,
          },
        );
      }

      // 2. Mark as sent
      await this.entityManager.transaction(async (manager) => {
        notification.isSent = true;
        await manager.save(notification);
      });

      this.logger.log(
        `Notification dispatched — notificationId: ${notificationId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to dispatch notification — notificationId: ${notificationId}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  // ------------------------------------------------------------------ //
  //  Nodemailer helpers
  // ------------------------------------------------------------------ //

  private buildTransporter(
    provider: EmailProvider,
    email: string,
    password: string,
  ): nodemailer.Transporter {
    if (provider === EmailProvider.GMAIL) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: email, pass: password },
      });
    } else if (provider === EmailProvider.OUTLOOK) {
      // Outlook / Office365 — STARTTLS on port 587, TLS 1.2+
      return nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false, // false = STARTTLS (not direct TLS on 465)
        requireTLS: true, // force STARTTLS upgrade; reject plain-text fallback
        auth: { user: email, pass: password },
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: false,
        },
      });
    }

    throw new Error(`Unsupported SMTP provider: ${provider as string}`);
  }

  // ------------------------------------------------------------------ //
  //  External HTTP mail service helper
  // ------------------------------------------------------------------ //

  private async sendViaMailService(
    apiKey: string,
    to: string,
    cc: string | undefined,
    subject: string,
    html: string,
  ): Promise<void> {
    const url =
      'https://mail-service-c6gcbxeye0dqbwg5.southeastasia-01.azurewebsites.net/mail/queue';

    const body = JSON.stringify({
      to,
      cc: cc ?? '',
      subject,
      text: 'Please view the HTML version of this message for details.',
      html,
    });

    // Guard: reject if the serialized payload exceeds 40 MB
    const bodySize = Buffer.byteLength(body, 'utf8');
    if (bodySize > MAX_EMAIL_SIZE_BYTES) {
      const sizeMb = (bodySize / 1024 / 1024).toFixed(2);
      throw new Error(
        `Mail service payload ${sizeMb} MB exceeds the 40 MB limit — send aborted`,
      );
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mail service responded ${response.status}: ${text}`);
    }

    this.logger.log(`Mail service queued — to: ${to}`);
  }
}
