import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetType } from './entities/asset-type.entity';
import { AssetTypeVariable } from './entities/asset-type-variable.entity';
import { AssetTypeController } from './controllers/asset-type.controller';
import { AssetTypeService } from './services/asset-type.service';
import { VariableDefinition } from '../variables/entities/variable-definition.entity';
import { Asset } from '../assets/entities/asset.entity';
import { AssetVariable } from '../assets/entities/asset-variable.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetType,
      AssetTypeVariable,
      VariableDefinition,
      Asset,
      AssetVariable,
    ]),
  ],
  controllers: [AssetTypeController],
  providers: [AssetTypeService],
})
export class AssetTypesModule {}
