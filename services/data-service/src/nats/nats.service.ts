import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { connect, NatsConnection, StringCodec } from 'nats';
import { MeasurementConsumer } from './measurement.consumer';

@Injectable()
export class NatsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NatsService.name);
  private connection?: NatsConnection;

  constructor(private readonly measurementConsumer: MeasurementConsumer) {}

  async onApplicationBootstrap(): Promise<void> {
    const url = process.env.NATS_URL ?? 'nats://localhost:4222';

    try {
      this.connection = await connect({ servers: url, maxReconnectAttempts: 0 });
      const subscription = this.connection.subscribe('industrial.measurements');
      const codec = StringCodec();
      void this.consume(subscription, codec);
      this.logger.log(`Subscribed to industrial.measurements on ${url}`);
    } catch (error) {
      this.logger.error(`NATS connection failed for ${url}: ${this.describe(error)}`);
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
        await this.measurementConsumer.processMessage(codec.decode(message.data));
      }
    } catch (error) {
      this.logger.error(`NATS measurement subscription stopped: ${this.describe(error)}`);
    }
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}