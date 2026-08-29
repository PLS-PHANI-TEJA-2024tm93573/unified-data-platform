import { ConflictException, NotFoundException } from '@nestjs/common';
import { AssetService } from './asset.service';
import { Asset } from '../entities/asset.entity';
import { AssetType } from '../../asset-types/entities/asset-type.entity';
import { AssetVariable } from '../entities/asset-variable.entity';

const repository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn((value) => Promise.resolve(value)),
  count: jest.fn(),
  remove: jest.fn(),
});

describe('AssetService', () => {
  let assetRepository: ReturnType<typeof repository>;
  let assetTypeRepository: ReturnType<typeof repository>;
  let assetVariableRepository: ReturnType<typeof repository>;
  let variableDefinitionRepository: ReturnType<typeof repository>;
  let assetTypeVariableRepository: ReturnType<typeof repository>;
  let service: AssetService;

  beforeEach(() => {
    assetRepository = repository();
    assetTypeRepository = repository();
    assetVariableRepository = repository();
    variableDefinitionRepository = repository();
    assetTypeVariableRepository = repository();
    service = new AssetService(
      assetRepository as never,
      assetTypeRepository as never,
      assetVariableRepository as never,
      variableDefinitionRepository as never,
      assetTypeVariableRepository as never,
    );
  });

  it('persists the supplied parent asset when creating an asset', async () => {
    const assetType = { id: 'type-id' } as AssetType;
    const parentAsset = { id: 'parent-id' } as Asset;
    assetTypeRepository.findOne.mockResolvedValue(assetType);
    assetRepository.findOne.mockResolvedValue(parentAsset);

    await service.create({
      name: 'Child',
      assetTypeId: 'type-id',
      parentAssetId: 'parent-id',
    });

    expect(assetRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ assetType, parentAsset }),
    );
  });

  it('rejects creation when the parent asset does not exist', async () => {
    assetTypeRepository.findOne.mockResolvedValue({ id: 'type-id' });
    assetRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Child',
        assetTypeId: 'type-id',
        parentAssetId: 'missing-parent',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an incompatible variable assignment', async () => {
    assetRepository.findOne.mockResolvedValue({
      id: 'asset-id',
      name: 'Motor',
      assetType: { id: 'type-id', name: 'MOTOR' },
    });
    variableDefinitionRepository.findOne.mockResolvedValue({
      id: 'variable-id',
      name: 'pressure',
    });
    assetTypeVariableRepository.findOne.mockResolvedValue(null);

    await expect(
      service.addVariable('asset-id', { variableDefinitionId: 'variable-id' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('protects an asset delete when assignments exist', async () => {
    assetRepository.findOne.mockResolvedValue({
      id: 'asset-id',
      name: 'Motor',
    });
    assetRepository.count.mockResolvedValue(0);
    assetVariableRepository.count.mockResolvedValue(1);

    await expect(service.remove('asset-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(assetRepository.remove).not.toHaveBeenCalled();
  });

  it('rejects self-parent updates', async () => {
    assetRepository.findOne.mockResolvedValue({
      id: 'asset-id',
      assetType: { id: 'type-id' },
    });

    await expect(
      service.update('asset-id', { parentAssetId: 'asset-id' }),
    ).rejects.toThrow('An asset cannot be its own parent');
  });

  it('loads assigned variables with their definitions', async () => {
    assetRepository.findOne.mockResolvedValue({ id: 'asset-id' });
    assetVariableRepository.find.mockResolvedValue([
      { variableDefinition: { id: 'variable-id' } } as AssetVariable,
    ]);

    await expect(service.getVariables('asset-id')).resolves.toHaveLength(1);
    expect(assetVariableRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { variableDefinition: true } }),
    );
  });
});
