import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AssetModelSyncService } from './asset-model-sync.service';
import { AssetModelGrpcService, AssetNode } from '../grpc/asset-model-grpc.service';

describe('AssetModelSyncService', () => {
  const upsert = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const execute = jest.fn<() => Promise<unknown>>();
  const where = jest.fn<(...args: unknown[]) => unknown>().mockReturnThis();
  const queryBuilder = { delete: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where, execute };
  const repository = {
    upsert,
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  };
  type MockManager = {
    getRepository: jest.Mock;
  };
  const manager: MockManager = {
    getRepository: jest.fn().mockReturnValue(repository),
  };
  const dataSource = {
    transaction: jest.fn(async (callback: (manager: MockManager) => Promise<void>) => callback(manager)),
  };
  const getAssetHierarchy = jest.fn<() => Promise<AssetNode[]>>();
  const grpc = { getAssetHierarchy } as unknown as AssetModelGrpcService;
  const service = new AssetModelSyncService(grpc, dataSource as never);

  beforeEach(() => {
    jest.clearAllMocks();
    execute.mockResolvedValue({});
    upsert.mockResolvedValue({});
  });

  it('recursively upserts nested asset variables and removes stale rows', async () => {
    const hierarchy: AssetNode[] = [
      {
        id: 'asset-root',
        name: 'Root',
        variables: [],
        children: [
          {
            id: 'asset-child',
            name: 'Child',
            variables: [
              {
                id: 'variable-1',
                name: 'Temperature',
                dataType: 'FLOAT',
                unit: 'C',
              },
            ],
            children: [],
          },
        ],
      },
    ];
    getAssetHierarchy.mockResolvedValue(hierarchy);

    await service.synchronize();

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          assetVariableId: 'variable-1',
          assetId: 'asset-child',
          name: 'Temperature',
          dataType: 'FLOAT',
          unit: 'C',
        }),
      ],
      ['assetVariableId'],
    );
    expect(where).toHaveBeenCalledWith(
      expect.stringContaining('asset_variable_id'),
      expect.objectContaining({ assetVariableId0: 'variable-1' }),
    );
    expect(execute).toHaveBeenCalled();
  });

  it('removes every cached row when the latest hierarchy has no variables', async () => {
    getAssetHierarchy.mockResolvedValue([]);

    await service.synchronize();

    expect(upsert).not.toHaveBeenCalled();
    expect(where).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });

  it('upserts each canonical AssetVariable ID only once', async () => {
    getAssetHierarchy.mockResolvedValue([
      {
        id: 'asset-root',
        name: 'Root',
        variables: [
          { id: 'variable-1', name: 'Temperature', dataType: 'FLOAT', unit: 'C' },
        ],
        children: [
          {
            id: 'asset-child',
            name: 'Child',
            variables: [
              { id: 'variable-1', name: 'Temperature', dataType: 'FLOAT', unit: 'C' },
            ],
            children: [],
          },
        ],
      },
    ]);

    await service.synchronize();

    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ assetVariableId: 'variable-1' })],
      ['assetVariableId'],
    );
  });

  it('synchronizes during application bootstrap', async () => {
    const synchronize = jest.spyOn(service, 'synchronize').mockResolvedValue();

    await service.onApplicationBootstrap();

    expect(synchronize).toHaveBeenCalledTimes(1);
  });
});