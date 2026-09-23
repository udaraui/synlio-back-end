import * as http from 'http';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from 'socket.io';
import { useAzureSocketIO } from '@azure/web-pubsub-socket.io';

@Injectable()
export class WebPubSubService implements OnModuleInit {
  private readonly logger = new Logger(WebPubSubService.name);
  private io: Server;

  constructor(private readonly configService: ConfigService) {}

  // ------------------------------------------------------------------ //
  //  Lifecycle
  // ------------------------------------------------------------------ //

  onModuleInit(): void {
    const connectionString = this.configService.getOrThrow<string>(
      'AZURE_WEBPUBSUB_CONNECTION_STRING',
    );
    const hub = this.configService.get<string>(
      'AZURE_WEBPUBSUB_HUB',
      'notifications',
    );

    const httpServer = http.createServer();
    this.io = new Server(httpServer);

    // Fire-and-forget — do NOT await here so app startup is never blocked.
    // If the connection string is wrong the error is logged and the service
    // stays in a degraded state (sendToUser is a no-op until io is ready).
    void this.connectToAzure(hub, connectionString);
  }

  private async connectToAzure(
    hub: string,
    connectionString: string,
  ): Promise<void> {
    try {
      // await useAzureSocketIO(this.io, { hub, connectionString });
      await useAzureSocketIO(this.io as any, { hub, connectionString });
      this.io.on('connection', (socket) => {
        const userId = socket.handshake.query['userId'] as string;

        if (userId) {
          void socket.join(`user-${userId}`);
          this.logger.log(
            `Socket connected — userId: ${userId} → room user-${userId}`,
          );
        } else {
          this.logger.warn(
            `Socket connected without userId — socketId: ${socket.id}`,
          );
        }

        socket.on('disconnect', () => {
          this.logger.debug(`Socket disconnected — socketId: ${socket.id}`);
        });
      });

      this.logger.log(`Azure Web PubSub Socket.IO initialised — hub: ${hub}`);
    } catch (err) {
      this.logger.error(
        'Azure Web PubSub failed to initialise — check AZURE_WEBPUBSUB_CONNECTION_STRING',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ------------------------------------------------------------------ //
  //  Public API
  // ------------------------------------------------------------------ //

  /**
   * Emit a real-time event to a specific user.
   * Silently skips if the service hasn't finished initializing yet.
   */
  sendToUser(userId: number, event: string, payload: unknown): void {
    if (!this.io) {
      this.logger.warn(
        `WebPubSub not initialised — skipping emit "${event}" for userId: ${userId}`,
      );
      return;
    }

    this.io.to(`user-${userId}`).emit(event, payload);
    this.logger.debug(`Emitted "${event}" → room user-${userId}`);
  }

  /**
   * Emit a real-time event to every connected client on the hub.
   */
  broadcast(event: string, payload: unknown): void {
    if (!this.io) {
      this.logger.warn(
        `WebPubSub not initialised — skipping broadcast "${event}"`,
      );
      return;
    }

    this.io.emit(event, payload);
    this.logger.debug(`Broadcast "${event}" to all clients`);
  }
}
