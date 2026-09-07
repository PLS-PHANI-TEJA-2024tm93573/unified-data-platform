import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AssetModelGrpcService, AssetNode } from '../grpc/asset-model-grpc.service';
import { DataServiceVariable } from '../database/entities/data-service-variable.entity';

type VariableCacheRow = Pick<
  DataServiceVariable,
  'assetVariableId' | 'assetId' | 'name' | 'dataType' | 'unit' | 'updatedAt'
>;

@Injectable()
export class AssetModelSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AssetModelSyncService.name);

  constructor(
    private readonly assetModelGrpcService: AssetModelGrpcService,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.synchronize();
    } catch (error) {
      this.logger.error('Asset Model metadata synchronization failed', error);
      throw error;
    }
  }

  async synchronize(): Promise<void> {
    const roots = await this.assetModelGrpcService.getAssetHierarchy();
    const rows = this.flattenHierarchy(roots);

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DataServiceVariable);
      if (rows.length > 0) {
        await repository.upsert(rows, ['assetVariableId']);
      }
      await this.removeStaleRows(manager, rows);
    });

    this.logger.log(`Synchronized ${rows.length} Asset Model variable relationships`);
  }

  private flattenHierarchy(roots: AssetNode[]): VariableCacheRow[] {
    const updatedAt = new Date();
    const rowsByAssetVariableId = new Map<string, VariableCacheRow>();

    const visit = (asset: AssetNode): void => {
      for (const variable of asset.variables ?? []) {
        rowsByAssetVariableId.set(variable.id, {
          assetVariableId: variable.id,
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
        .map(
          (_, index) =>
            `("asset_variable_id" = :assetVariableId${index})`,
        )
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