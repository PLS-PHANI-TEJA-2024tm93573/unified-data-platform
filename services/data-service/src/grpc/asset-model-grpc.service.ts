import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';

interface AssetModelGrpcClient {
  getAssetHierarchy(request: {}): Observable<{
    roots: AssetNode[];
  }>;
}

export interface AssetNode {
  id: string;
  name: string;
  assetType?: {
    id: string;
    name: string;
  };
  variables: AssetVariable[];
  children: AssetNode[];
}

export interface AssetVariable {
  id: string;
  name: string;
  dataType: string;
  unit: string;
}

@Injectable()
export class AssetModelGrpcService implements OnModuleInit {
  private assetModelClient!: AssetModelGrpcClient;

  constructor(
    @Inject('ASSET_MODEL_SERVICE')
    private readonly grpcClient: ClientGrpc
  ) {}

  onModuleInit() {
    this.assetModelClient =
      this.grpcClient.getService<AssetModelGrpcClient>('AssetModelService');
  }

  async getAssetHierarchy(): Promise<AssetNode[]> {
    const response = await firstValueFrom(
      this.assetModelClient.getAssetHierarchy({}),
    );

    return response.roots ?? [];
  }
}