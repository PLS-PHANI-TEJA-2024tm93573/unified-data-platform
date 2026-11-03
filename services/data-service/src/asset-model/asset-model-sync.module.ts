import { Module } from '@nestjs/common';
import { AssetModelSyncService } from './asset-model-sync.service';

@Module({
  providers: [AssetModelSyncService],
  exports: [AssetModelSyncService],
})
export class AssetModelSyncModule {}
