import { connect } from 'nats';
import { MetadataChangeDetectorService } from './metadata-change-detector.service';

jest.mock('nats', () => ({
  connect: jest.fn(),
  StringCodec: () => ({
    encode: (value: string) => new TextEncoder().encode(value),
  }),
}));

describe('MetadataChangeDetectorService', () => {
  const connection = {
    publish: jest.fn(),
    flush: jest.fn(),
    drain: jest.fn(),
    close: jest.fn(),
  };
  let service: MetadataChangeDetectorService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (connect as jest.Mock).mockResolvedValue(connection);
    connection.flush.mockResolvedValue(undefined);
    connection.drain.mockResolvedValue(undefined);
    service = new MetadataChangeDetectorService({
      get: (key: string, fallback: unknown) =>
        key === 'ASSET_METADATA_DEBOUNCE_MS' ? 100 : fallback,
    } as never);
  });

  afterEach(async () => {
    await service.onApplicationShutdown();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('publishes once after a single mutation has been quiet', async () => {
    service.markChanged();
    await jest.advanceTimersByTimeAsync(100);

    expect(connection.publish).toHaveBeenCalledTimes(1);
    expect(connection.publish).toHaveBeenCalledWith(
      'asset.metadata.update',
      expect.any(Uint8Array),
    );
    const payload = JSON.parse(
      new TextDecoder().decode(connection.publish.mock.calls[0][1]),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        eventType: 'ASSET_METADATA_UPDATE',
        source: 'asset-model-service',
        timestamp: expect.any(String),
        eventId: expect.any(String),
      }),
    );
  });

  it('resets the timer for nearby mutations and publishes once', async () => {
    service.markChanged();
    await jest.advanceTimersByTimeAsync(75);
    service.markChanged();
    await jest.advanceTimersByTimeAsync(99);
    expect(connection.publish).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(connection.publish).toHaveBeenCalledTimes(1);
  });

  it('keeps pending work and retries after a publish failure', async () => {
    (connect as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    service.markChanged();
    await jest.advanceTimersByTimeAsync(100);
    expect(connect).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('clears the pending timer on shutdown', async () => {
    service.markChanged();
    await service.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(100);
    expect(connection.publish).not.toHaveBeenCalled();
  });
});
