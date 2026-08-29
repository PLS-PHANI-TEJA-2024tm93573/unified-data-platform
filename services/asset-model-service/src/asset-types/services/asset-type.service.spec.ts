import { ConflictException, NotFoundException } from '@nestjs/common';
import { AssetTypeService } from './asset-type.service';
import { AssetType } from '../entities/asset-type.entity';

const repository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn((value) => Promise.resolve(value)),
  count: jest.fn(),
  remove: jest.fn(),
});

describe('AssetTypeService', () => {
  let assetTypeRepository: ReturnType<typeof repository>;
  let associationRepository: ReturnType<typeof repository>;
  let variableRepository: ReturnType<typeof repository>;
  let assetRepository: ReturnType<typeof repository>;
  let assetVariableRepository: ReturnType<typeof repository>;
  let service: AssetTypeService;

  beforeEach(() => {
    assetTypeRepository = repository();
    associationRepository = repository();
    variableRepository = repository();
    assetRepository = repository();
    assetVariableRepository = repository();
    service = new AssetTypeService(
      assetTypeRepository as never,
      associationRepository as never,
      variableRepository as never,
      assetRepository as never,
      assetVariableRepository as never,
    );
  });

  it('creates and retrieves an AssetType', async () => {
    assetTypeRepository.findOne.mockResolvedValue(null);
    const assetType = { id: 'type-id', name: 'MOTOR' } as AssetType;
    assetTypeRepository.create.mockReturnValue(assetType);

    await expect(service.create({ name: 'MOTOR' })).resolves.toBe(assetType);
    assetTypeRepository.findOne.mockResolvedValue(assetType);
    await expect(service.getAssetTypeById('type-id')).resolves.toBe(assetType);
  });

  it('rejects duplicate names and missing resources', async () => {
    assetTypeRepository.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ name: 'MOTOR' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    assetTypeRepository.findOne.mockResolvedValue(null);
    await expect(service.getAssetTypeById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates associations and rejects duplicates', async () => {
    assetTypeRepository.findOne.mockResolvedValue({
      id: 'type-id',
      name: 'MOTOR',
    });
    variableRepository.findOne.mockResolvedValue({
      id: 'variable-id',
      name: 'temperature',
    });
    associationRepository.findOne.mockResolvedValue(null);

    await expect(
      service.addVariable('type-id', {
        variableDefinitionId: 'variable-id',
        required: true,
      }),
    ).resolves.toBeDefined();

    associationRepository.findOne.mockResolvedValue({ id: 'association-id' });
    await expect(
      service.addVariable('type-id', {
        variableDefinitionId: 'variable-id',
        required: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('protects deletion when related assets exist', async () => {
    assetTypeRepository.findOne.mockResolvedValue({
      id: 'type-id',
      name: 'MOTOR',
    });
    assetRepository.count.mockResolvedValue(1);
    associationRepository.count.mockResolvedValue(0);

    await expect(service.remove('type-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('removes an unreferenced association', async () => {
    associationRepository.findOne.mockResolvedValue({ id: 'association-id' });
    assetVariableRepository.findOne.mockResolvedValue(null);

    await expect(
      service.removeVariable('type-id', 'variable-id'),
    ).resolves.toMatchObject({ message: expect.any(String) });
    expect(associationRepository.remove).toHaveBeenCalled();
  });
});
