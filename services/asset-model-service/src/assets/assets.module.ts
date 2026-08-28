import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './entities/asset.entity';
import { AssetVariable } from './entities/asset-variable.entity';
import { AssetType } from '../asset-types/entities/asset-type.entity';
import { AssetService } from './services/asset.service';
import { AssetController } from './controllers/asset.controller';
import { VariableDefinition } from '../variables/entities/variable-definition.entity';
import { AssetTypeVariable } from '../asset-types/entities/asset-type-variable.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      AssetVariable,
      AssetType,
      VariableDefinition,
      AssetTypeVariable,
    ]),
  ],
  providers: [AssetService],
  controllers: [AssetController],
})
export class AssetsModule {}
