import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetType } from './entities/asset-type.entity';
import { AssetTypeVariable } from './entities/asset-type-variable.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([AssetType,AssetTypeVariable])
    ]


})
export class AssetTypesModule {}
