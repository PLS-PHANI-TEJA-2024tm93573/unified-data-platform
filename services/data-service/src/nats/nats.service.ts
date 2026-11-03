import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { connect, NatsConnection, StringCodec } from 'nats';
import { MeasurementConsumer } from './measurement.consumer';
import { AssetModelSyncService } from '../asset-model/asset-model-sync.service';

@Injectable()
export class NatsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(NatsService.name);
  private connection?: NatsConnection;

  constructor(
    private readonly measurementConsumer: MeasurementConsumer,
    private readonly assetModelSyncService: AssetModelSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const url = process.env.NATS_URL ?? 'nats://localhost:4222';

    try {
      this.connection = await connect({
        servers: url,
        maxReconnectAttempts: 0,
      });
      const subscription = this.connection.subscribe('industrial.measurements');
      const metadataSubscription = this.connection.subscribe(
        'asset.metadata.update',
      );
      const codec = StringCodec();
      void this.consume(subscription, codec);
      void this.consumeMetadata(metadataSubscription, codec);
      this.logger.log(
        `Subscribed to industrial.measurements and asset.metadata.update on ${url}`,
      );
    } catch (error) {
      this.logger.error(
        `NATS connection failed for ${url}: ${this.describe(error)}`,
      );
    }
  }

  private async consumeMetadata(
    subscription: ReturnType<NatsConnection['subscribe']>,
    codec: ReturnType<typeof StringCodec>,
  ): Promise<void> {
    try {
      for await (const message of subscription) {
        this.assetModelSyncService.processNotification(
          codec.decode(message.data),
        );
      }
    } catch (error) {
      this.logger.error(
        `Asset metadata subscription stopped: ${this.describe(error)}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
    }
  }

  private async consume(
    subscription: ReturnType<NatsConnection['subscribe']>,
    codec: ReturnType<typeof StringCodec>,
  ): Promise<void> {
    try {
      for await (const message of subscription) {
        await this.measurementConsumer.processMessage(
          codec.decode(message.data),
        );
      }
    } catch (error) {
      this.logger.error(
        `NATS measurement subscription stopped: ${this.describe(error)}`,
      );
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
