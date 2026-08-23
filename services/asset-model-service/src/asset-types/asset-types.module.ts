import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetType } from './entities/asset-type.entity';
import { AssetTypeVariable } from './entities/asset-type-variable.entity';
import { AssetTypeController } from './controllers/asset-type.controller';
import { AssetTypeService } from './services/asset-type.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([AssetType,AssetTypeVariable])
    ],
    controllers:[AssetTypeController],
    providers:[AssetTypeService]


})
export class AssetTypesModule {}
