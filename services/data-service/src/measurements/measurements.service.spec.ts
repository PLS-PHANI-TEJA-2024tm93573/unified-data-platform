import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { MeasurementQueryDto } from './dto/measurement-query.dto';

const assetVariableId = '11111111-1111-4111-8111-111111111111';
const metadata = {
  assetVariableId,
  assetId: '22222222-2222-4222-8222-222222222222',
  name: 'Temperature',
  dataType: 'FLOAT',
  unit: 'C',
  updatedAt: new Date(),
};

function createService(measurements: unknown[] = []) {
  const getMany = jest.fn().mockResolvedValue(measurements);
  const getOne = jest.fn();
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany,
    getOne,
  };
  const createQueryBuilder = jest.fn().mockReturnValue(builder);
  const findOneBy = jest.fn().mockResolvedValue(metadata);
  const service = new MeasurementsService(
    { createQueryBuilder } as never,
    { findOneBy } as never,
  );
  return { service, builder, createQueryBuilder, findOneBy, getMany, getOne };
}

const query: MeasurementQueryDto = {
  asset_variable_id: assetVariableId,
  from: '2026-09-06T14:00:00Z',
  to: '2026-09-06T15:00:00Z',
};

describe('MeasurementsService', () => {
  it('queries one variable in range, chronologically, with an optional limit', async () => {
    const first = {
      timestamp: new Date('2026-09-06T14:00:00Z'),
      numericValue: 72.4,
      booleanValue: null,
      textValue: null,
    };
    const second = {
      timestamp: new Date('2026-09-06T14:01:00Z'),
      numericValue: 72.8,
      booleanValue: null,
      textValue: null,
    };
    const { service, builder } = createService([first, second]);

    const response = await service.findInRange({ ...query, limit: 2 });

    expect(builder.where).toHaveBeenCalledWith(
      'measurement.variable_id = :variableId',
      { variableId: assetVariableId },
    );
    expect(builder.andWhere).toHaveBeenNthCalledWith(1, 'measurement.timestamp >= :from', expect.any(Object));
    expect(builder.andWhere).toHaveBeenNthCalledWith(2, 'measurement.timestamp <= :to', expect.any(Object));
    expect(builder.orderBy).toHaveBeenCalledWith('measurement.timestamp', 'ASC');
    expect(builder.limit).toHaveBeenCalledWith(2);
    expect(response.data).toEqual([
      { timestamp: '2026-09-06T14:00:00.000Z', value: 72.4 },
      { timestamp: '2026-09-06T14:01:00.000Z', value: 72.8 },
    ]);
  });

  it('returns an empty data array when the range has no measurements', async () => {
    const { service } = createService([]);

    await expect(service.findInRange(query)).resolves.toMatchObject({
      asset_variable_id: assetVariableId,
      data: [],
    });
  });

  it('rejects a range where from is later than to', async () => {
    const { service } = createService();

    await expect(
      service.findInRange({ ...query, from: '2026-09-06T16:00:00Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['numericValue', { numericValue: 12.5, booleanValue: null, textValue: null }, 12.5],
    ['booleanValue', { numericValue: null, booleanValue: false, textValue: null }, false],
    ['textValue', { numericValue: null, booleanValue: null, textValue: 'RUNNING' }, 'RUNNING'],
  ])('normalizes %s without exposing database columns', async (_name, values, expected) => {
    const { service, getOne } = createService();
    getOne.mockResolvedValue({ timestamp: new Date('2026-09-06T14:02:00Z'), ...values });

    const response = await service.findLatest(assetVariableId);

    expect(response).toMatchObject({
      asset_variable_id: assetVariableId,
      timestamp: '2026-09-06T14:02:00.000Z',
      value: expected,
    });
    expect(response).not.toHaveProperty('numericValue');
    expect(response).not.toHaveProperty('booleanValue');
    expect(response).not.toHaveProperty('textValue');
  });

  it('returns 404 when the latest measurement does not exist', async () => {
    const { service, getOne } = createService();
    getOne.mockResolvedValue(undefined);

    await expect(service.findLatest(assetVariableId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 when the AssetVariable is missing from the cache', async () => {
    const { service, findOneBy } = createService();
    findOneBy.mockResolvedValue(undefined);

    await expect(service.findInRange(query)).rejects.toBeInstanceOf(NotFoundException);
  });
});