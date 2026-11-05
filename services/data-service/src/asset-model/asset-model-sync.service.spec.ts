import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AssetModelSyncService } from './asset-model-sync.service';

const uiNode = (
  id: string,
  name: string,
  variables: unknown[] = [],
  children: unknown[] = [],
) => ({
  key: id,
  label: name,
  data: { id, name, variables },
  children,
});

describe('AssetModelSyncService', () => {
  const upsert = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const execute = jest.fn<() => Promise<unknown>>();
  const where = jest.fn<(...args: unknown[]) => unknown>().mockReturnThis();
  const queryBuilder = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where,
    execute,
  };
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
    transaction: jest.fn(
      async (callback: (manager: MockManager) => Promise<void>) =>
        callback(manager),
    ),
  };
  const service = new AssetModelSyncService(dataSource as never);

  beforeEach(() => {
    jest.clearAllMocks();
    execute.mockResolvedValue({});
    upsert.mockResolvedValue({});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as never;
  });

  it('recursively upserts nested asset variables and removes stale rows', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          uiNode(
            'asset-root',
            'Root',
            [],
            [
              uiNode('asset-child', 'Child', [
                {
                  assetVariableId: 'asset-variable-1',
                  name: 'Temperature',
                  dataType: 'FLOAT',
                  unit: 'C',
                },
              ]),
            ],
          ),
        ]),
    });

    await service.synchronize();

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          assetVariableId: 'asset-variable-1',
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
      expect.objectContaining({ assetVariableId0: 'asset-variable-1' }),
    );
    expect(execute).toHaveBeenCalled();
  });

  it('removes every cached row when the latest hierarchy has no variables', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await service.synchronize();

    expect(upsert).not.toHaveBeenCalled();
    expect(where).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });

  it('upserts each canonical AssetVariable ID only once', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          uiNode(
            'asset-root',
            'Root',
            [
              {
                assetVariableId: 'asset-variable-1',
                name: 'Temperature',
                dataType: 'FLOAT',
                unit: 'C',
              },
            ],
            [
              uiNode('asset-child', 'Child', [
                {
                  assetVariableId: 'asset-variable-2',
                  name: 'Temperature',
                  dataType: 'FLOAT',
                  unit: 'C',
                },
              ]),
            ],
          ),
        ]),
    });

    await service.synchronize();

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({ assetVariableId: 'asset-variable-1' }),
        expect.objectContaining({ assetVariableId: 'asset-variable-2' }),
      ],
      ['assetVariableId'],
    );
  });

  it('synchronizes during application bootstrap', async () => {
    const synchronize = jest.spyOn(service, 'synchronize').mockResolvedValue();

    await service.onApplicationBootstrap();

    expect(synchronize).toHaveBeenCalledTimes(1);
    synchronize.mockRestore();
    await service.onApplicationShutdown();
  });

  it('uses the configured hierarchy endpoint', async () => {
    process.env.ASSET_MODEL_URL = 'http://asset-model:3000';
    await service.synchronize();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://asset-model:3000/assets/hierarchy',
      expect.objectContaining({ signal: expect.anything() }),
    );
    delete process.env.ASSET_MODEL_URL;
  });

  it('preserves the active cache when hierarchy retrieval fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
    await expect(service.synchronize()).rejects.toThrow('HTTP 503');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('keeps booting and retries a failed initial sync after ten seconds', async () => {
    jest.useFakeTimers();
    process.env.ASSET_METADATA_RECONCILIATION_MS = '1000';
    const retryingService = new AssetModelSyncService(dataSource as never);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

    await expect(
      retryingService.onApplicationBootstrap(),
    ).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(10_000);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    await retryingService.onApplicationShutdown();
    delete process.env.ASSET_METADATA_RECONCILIATION_MS;
    jest.useRealTimers();
  });

  it('refreshes on a valid notification and ignores malformed payloads', async () => {
    const valid = JSON.stringify({
      eventId: 'event-1',
      eventType: 'ASSET_METADATA_UPDATE',
      source: 'asset-model-service',
      timestamp: new Date().toISOString(),
    });
    expect(service.processNotification('{')).toBe(false);
    expect(service.processNotification(valid)).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));
    expect(global.fetch).toHaveBeenCalled();
    await service.onApplicationShutdown();
  });

  it('coalesces notifications received during a hierarchy fetch', async () => {
    let releaseFirst!: (value: unknown) => void;
    const firstResponse = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    (global.fetch as jest.Mock)
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });

    const first = service.synchronize();
    const second = service.synchronize();
    releaseFirst({ ok: true, json: () => Promise.resolve([]) });
    await Promise.all([first, second]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('runs periodic reconciliation and cancels it on shutdown', async () => {
    jest.useFakeTimers();
    process.env.ASSET_METADATA_RECONCILIATION_MS = '1000';
    const periodicService = new AssetModelSyncService(dataSource as never);
    await periodicService.onApplicationBootstrap();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    await periodicService.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(5000);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    delete process.env.ASSET_METADATA_RECONCILIATION_MS;
    jest.useRealTimers();
  });
});
