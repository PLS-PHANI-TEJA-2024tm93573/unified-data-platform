import { describe, expect, it, jest } from '@jest/globals';
import { DataServiceVariable } from '../database/entities/data-service-variable.entity';
import { MeasurementConsumer } from './measurement.consumer';

const variableId = '11111111-1111-4111-8111-111111111111';
const timestamp = '2026-09-06T14:00:00Z';

describe('MeasurementConsumer', () => {
  function createConsumer(dataType: string, value = 72.4) {
    const findOneBy = jest.fn().mockResolvedValue({
      assetVariableId: variableId,
      assetId: '22222222-2222-4222-8222-222222222222',
      name: 'Test Variable',
      dataType,
      unit: null,
      updatedAt: new Date(),
    } satisfies DataServiceVariable);
    const query = jest.fn().mockResolvedValue([]);
    const consumer = new MeasurementConsumer(
      { findOneBy } as never,
      { query } as never,
    );
    return { consumer, findOneBy, query, value };
  }

  it.each([
    ['FLOAT', 72.4, [72.4, null, null]],
    ['INTEGER', 1500, [1500, null, null]],
    ['BOOLEAN', true, [null, true, null]],
    ['STRING', 'RUNNING', [null, null, 'RUNNING']],
  ])('persists a valid %s value in its typed column', async (dataType, value, columns) => {
    const { consumer, query } = createConsumer(dataType, value as number);

    await expect(
      consumer.processMessage(
        JSON.stringify({ variable_id: variableId, timestamp, value }),
      ),
    ).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), [
      variableId,
      new Date(timestamp),
      ...columns,
    ]);
  });

  it('rejects an unknown AssetVariable without inserting', async () => {
    const { consumer, findOneBy, query } = createConsumer('FLOAT');
    findOneBy.mockResolvedValue(undefined);

    await expect(
      consumer.processMessage(JSON.stringify({ variable_id: variableId, timestamp, value: 1 })),
    ).resolves.toBe(false);

    expect(query).not.toHaveBeenCalled();
  });

  it('rejects invalid UUIDs and timestamps', async () => {
    const { consumer, findOneBy } = createConsumer('FLOAT');

    await expect(
      consumer.processMessage(
        JSON.stringify({ variable_id: 'not-a-uuid', timestamp, value: 1 }),
      ),
    ).resolves.toBe(false);
    await expect(
      consumer.processMessage(
        JSON.stringify({ variable_id: variableId, timestamp: 'invalid', value: 1 }),
      ),
    ).resolves.toBe(false);

    expect(findOneBy).toHaveBeenCalledTimes(0);
  });

  it('rejects missing values and type mismatches', async () => {
    const { consumer, query } = createConsumer('INTEGER');

    await expect(
      consumer.processMessage(JSON.stringify({ variable_id: variableId, timestamp })),
    ).resolves.toBe(false);
    await expect(
      consumer.processMessage(
        JSON.stringify({ variable_id: variableId, timestamp, value: true }),
      ),
    ).resolves.toBe(false);

    expect(query).not.toHaveBeenCalled();
  });
});