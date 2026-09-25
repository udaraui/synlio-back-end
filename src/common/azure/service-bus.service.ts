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
import { EmailClient } from '@azure/communication-email';
import { Email } from '../../alert/email/email.entity';
import { Notification } from '../../alert/notification/notification.entity';
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
  private emailClient: EmailClient;
  private senderEmailAddress: string;

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

    const emailConnectionString = this.configService.getOrThrow<string>(
      'AZURE_COMMUNICATION_CONNECTION_STRING',
    );
    this.senderEmailAddress = this.configService.getOrThrow<string>(
      'AZURE_COMMUNICATION_SENDER_EMAIL',
    );
    this.emailClient = new EmailClient(emailConnectionString);

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

      // 2. Send real email using Azure Communication Services
      const message: any = {
        senderAddress: this.senderEmailAddress,
        content: {
          subject: email.subject ?? '(no subject)',
          html: email.description ?? '',
        },
        recipients: {
          to: email.to
            .split(',')
            .map((e) => ({ address: e.trim() }))
            .filter((e) => e.address),
        },
      };

      if (email.ccTo) {
        message.recipients.cc = email.ccTo
          .split(',')
          .map((e) => ({ address: e.trim() }))
          .filter((e) => e.address);
      }

      const poller = await this.emailClient.beginSend(message);
      await poller.pollUntilDone();

      this.logger.log(`Email sent via ACS — to: ${email.to}`);

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


}
