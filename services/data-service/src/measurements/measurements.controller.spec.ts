import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MeasurementsController } from './measurements.controller';
import { MeasurementsService } from './measurements.service';

const assetVariableId = '11111111-1111-4111-8111-111111111111';
const validQuery = {
  asset_variable_id: assetVariableId,
  from: '2026-09-06T14:00:00Z',
  to: '2026-09-06T15:00:00Z',
};

describe('MeasurementsController', () => {
  let app: INestApplication;
  const service = {
    findInRange: jest.fn(),
    findLatest: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MeasurementsController],
      providers: [{ provide: MeasurementsService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a valid range query and delegates it to the service', async () => {
    service.findInRange.mockResolvedValue({ asset_variable_id: assetVariableId, data: [] });

    await request(app.getHttpServer()).get('/measurements').query(validQuery).expect(200);

    expect(service.findInRange).toHaveBeenCalledWith(
      expect.objectContaining(validQuery),
    );
  });

  it.each([
    ['asset_variable_id', { ...validQuery, asset_variable_id: 'invalid' }],
    ['from', { ...validQuery, from: 'invalid' }],
    ['to', { ...validQuery, to: 'invalid' }],
    ['limit', { ...validQuery, limit: '0' }],
    ['maximum limit', { ...validQuery, limit: '10001' }],
  ])('rejects invalid %s with HTTP 400', async (_field, query) => {
    await request(app.getHttpServer()).get('/measurements').query(query).expect(400);
    expect(service.findInRange).not.toHaveBeenCalled();
  });

  it('rejects an invalid latest AssetVariable UUID with HTTP 400', async () => {
    await request(app.getHttpServer()).get('/measurements/invalid/latest').expect(400);
    expect(service.findLatest).not.toHaveBeenCalled();
  });
});