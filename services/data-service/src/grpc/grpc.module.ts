import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AssetModelGrpcService } from './asset-model-grpc.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ASSET_MODEL_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'assetmodel',
          protoPath: join(__dirname, 'proto/asset-model.proto'),
          url: process.env.ASSET_MODEL_GRPC_URL || 'localhost:50051',
        },
      },
    ]),
  ],
  providers: [AssetModelGrpcService],
  exports: [ClientsModule, AssetModelGrpcService],
})
export class GrpcModule {}