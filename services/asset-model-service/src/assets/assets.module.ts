import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './entities/asset.entity';
import { AssetVariable } from './entities/asset-variable.entity';

@Module({
    imports:[
        TypeOrmModule.forFeature([Asset,AssetVariable])
    ]
        })
export class AssetsModule {}
