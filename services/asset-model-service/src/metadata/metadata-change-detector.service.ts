import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, NatsConnection, StringCodec } from 'nats';
import { randomUUID } from 'node:crypto';

export const ASSET_METADATA_UPDATE_SUBJECT = 'asset.metadata.update';

@Injectable()
export class MetadataChangeDetectorService implements OnApplicationShutdown {
  private readonly logger = new Logger(MetadataChangeDetectorService.name);
  private readonly quietPeriodMs: number;
  private readonly natsUrl: string;
  private connection?: NatsConnection;
  private timer?: NodeJS.Timeout;
  private dirty = false;
  private publishing = false;

  constructor(config: ConfigService) {
    this.quietPeriodMs = this.readQuietPeriod(config);
    this.natsUrl = config.get<string>('NATS_URL', 'nats://localhost:4222');
  }

  markChanged(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(
      () => void this.publishIfDirty(),
      this.quietPeriodMs,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.connection) await this.connection.drain();
  }

  private async publishIfDirty(): Promise<void> {
    this.timer = undefined;
    if (!this.dirty || this.publishing) return;

    this.publishing = true;
    this.dirty = false;
    const event = {
      eventId: randomUUID(),
      eventType: 'ASSET_METADATA_UPDATE',
      source: 'asset-model-service',
      timestamp: new Date().toISOString(),
    };
    try {
      this.connection ??= await connect({
        servers: this.natsUrl,
        maxReconnectAttempts: 0,
      });
      this.connection.publish(
        ASSET_METADATA_UPDATE_SUBJECT,
        StringCodec().encode(JSON.stringify(event)),
      );
      await this.connection.flush();
      this.logger.log(
        `Published ${ASSET_METADATA_UPDATE_SUBJECT} notification`,
      );
    } catch (error) {
      this.dirty = true;
      this.logger.error(
        `Failed to publish ${ASSET_METADATA_UPDATE_SUBJECT}: ${this.describe(error)}`,
      );
      if (this.connection) {
        void this.connection.close().catch(() => undefined);
      }
      this.connection = undefined;
    } finally {
      this.publishing = false;
      if (this.dirty && !this.timer) {
        this.timer = setTimeout(
          () => void this.publishIfDirty(),
          this.quietPeriodMs,
        );
      }
    }
  }

  private readQuietPeriod(config: ConfigService): number {
    const value = Number(config.get('ASSET_METADATA_DEBOUNCE_MS', 3000));
    return Number.isFinite(value) && value >= 0 ? value : 3000;
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
