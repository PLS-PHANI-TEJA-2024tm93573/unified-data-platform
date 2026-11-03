import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DataServiceVariable } from '../database/entities/data-service-variable.entity';

type AssetNode = {
  id: string;
  name: string;
  variables: Array<{
    assetVariableId: string;
    name: string;
    dataType: string;
    unit?: string | null;
  }>;
  children: AssetNode[];
};

type VariableCacheRow = Pick<
  DataServiceVariable,
  'assetVariableId' | 'assetId' | 'name' | 'dataType' | 'unit' | 'updatedAt'
>;

@Injectable()
export class AssetModelSyncService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AssetModelSyncService.name);
  private syncPromise?: Promise<void>;
  private syncPending = false;
  private reconciliationTimer?: NodeJS.Timeout;
  private reconciliationIntervalMs: number;

  constructor(private readonly dataSource: DataSource) {
    this.reconciliationIntervalMs = Number(
      process.env.ASSET_METADATA_RECONCILIATION_MS ?? 300000,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.synchronize();
      this.startPeriodicReconciliation();
    } catch (error) {
      this.logger.error('Asset Model metadata synchronization failed', error);
      throw error;
    }
  }

  async synchronize(): Promise<void> {
    this.syncPending = true;
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = this.synchronizePendingChanges();
    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = undefined;
      if (this.syncPending) {
        void this.synchronize().catch((error) => {
          this.logger.error(
            'Coalesced Asset Model metadata synchronization failed',
            error,
          );
        });
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
    this.reconciliationTimer = undefined;
    await this.syncPromise;
  }

  private async synchronizePendingChanges(): Promise<void> {
    while (this.syncPending) {
      this.syncPending = false;
      const roots = await this.fetchHierarchy();
      const rows = this.flattenHierarchy(roots);

      await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(DataServiceVariable);
        if (rows.length > 0) {
          await repository.upsert(rows, ['assetVariableId']);
        }
        await this.removeStaleRows(manager, rows);
      });

      this.logger.log(
        `Synchronized ${rows.length} Asset Model variable relationships`,
      );
    }
  }

  private async fetchHierarchy(): Promise<AssetNode[]> {
    const baseUrl = process.env.ASSET_MODEL_URL ?? 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl.replace(/\/$/, '')}/assets/hierarchy`,
      {
        signal: AbortSignal.timeout(
          Number(process.env.ASSET_MODEL_HTTP_TIMEOUT_MS ?? 10000),
        ),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Asset Model hierarchy request failed with HTTP ${response.status}`,
      );
    }
    const body: unknown = await response.json();
    if (!Array.isArray(body))
      throw new Error('Asset Model hierarchy response must be an array');
    return body.map((node) => this.parseTreeNode(node));
  }

  private parseTreeNode(value: unknown): AssetNode {
    if (!value || typeof value !== 'object')
      throw new Error('Invalid hierarchy node');
    const node = value as Record<string, unknown>;
    const data = node.data as Record<string, unknown> | undefined;
    if (
      !data ||
      typeof data.id !== 'string' ||
      typeof data.name !== 'string' ||
      !Array.isArray(data.variables)
    ) {
      throw new Error('Invalid hierarchy node data');
    }
    if (node.children !== undefined && !Array.isArray(node.children))
      throw new Error('Invalid hierarchy children');
    const variables = data.variables.map((item) => {
      if (!item || typeof item !== 'object')
        throw new Error('Invalid hierarchy variable');
      const variable = item as Record<string, unknown>;
      if (
        typeof variable.assetVariableId !== 'string' ||
        typeof variable.name !== 'string' ||
        typeof variable.dataType !== 'string'
      ) {
        throw new Error('Invalid hierarchy variable fields');
      }
      return {
        assetVariableId: variable.assetVariableId,
        name: variable.name,
        dataType: variable.dataType,
        unit: typeof variable.unit === 'string' ? variable.unit : null,
      };
    });
    return {
      id: data.id,
      name: data.name,
      variables,
      children: ((node.children as unknown[]) ?? []).map((child) =>
        this.parseTreeNode(child),
      ),
    };
  }

  private startPeriodicReconciliation(): void {
    const raw = Number(process.env.ASSET_METADATA_RECONCILIATION_MS ?? 300000);
    this.reconciliationIntervalMs =
      Number.isFinite(raw) && raw > 0 ? raw : 300000;
    this.reconciliationTimer = setInterval(() => {
      void this.synchronize().catch((error) => {
        this.logger.error(
          'Periodic Asset Model metadata synchronization failed',
          error,
        );
      });
    }, this.reconciliationIntervalMs);
  }

  processNotification(payload: string): boolean {
    try {
      const event: unknown = JSON.parse(payload);
      if (!event || typeof event !== 'object') return false;
      const value = event as Record<string, unknown>;
      if (
        value.eventType !== 'ASSET_METADATA_UPDATE' ||
        value.source !== 'asset-model-service' ||
        typeof value.eventId !== 'string' ||
        typeof value.timestamp !== 'string' ||
        Number.isNaN(Date.parse(value.timestamp))
      ) {
        this.logger.warn('Ignored malformed Asset Model metadata notification');
        return false;
      }
      void this.synchronize().catch((error) => {
        this.logger.error(
          'Event-triggered Asset Model metadata synchronization failed',
          error,
        );
      });
      return true;
    } catch {
      this.logger.warn('Ignored malformed Asset Model metadata notification');
      return false;
    }
  }

  private flattenHierarchy(roots: AssetNode[]): VariableCacheRow[] {
    const updatedAt = new Date();
    const rowsByAssetVariableId = new Map<string, VariableCacheRow>();

    const visit = (asset: AssetNode): void => {
      for (const variable of asset.variables ?? []) {
        rowsByAssetVariableId.set(variable.assetVariableId, {
          assetVariableId: variable.assetVariableId,
          assetId: asset.id,
          name: variable.name,
          dataType: variable.dataType,
          unit: variable.unit ?? null,
          updatedAt,
        });
      }

      for (const child of asset.children ?? []) {
        visit(child);
      }
    };

    for (const root of roots) {
      visit(root);
    }

    return Array.from(rowsByAssetVariableId.values());
  }

  private async removeStaleRows(
    manager: EntityManager,
    currentRows: VariableCacheRow[],
  ): Promise<void> {
    const query = manager
      .getRepository(DataServiceVariable)
      .createQueryBuilder()
      .delete()
      .from(DataServiceVariable);

    if (currentRows.length === 0) {
      await query.execute();
      return;
    }

    query.where(
      `NOT (${currentRows
        .map((_, index) => `("asset_variable_id" = :assetVariableId${index})`)
        .join(' OR ')})`,
      Object.fromEntries(
        currentRows.map((row, index) => [
          `assetVariableId${index}`,
          row.assetVariableId,
        ]),
      ),
    );

    await query.execute();
  }
}
