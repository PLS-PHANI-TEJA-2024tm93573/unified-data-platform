import { ConflictException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { VariableDefinitionService } from './variable-definition.service';
import { CreateVariableDefinitionDto } from '../dto/create-variable-definition.dto';
import { VariableDefinition } from '../entities/variable-definition.entity';

const repository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn((value) => Promise.resolve(value)),
  count: jest.fn(),
  remove: jest.fn(),
});

describe('VariableDefinitionService', () => {
  let variableRepository: ReturnType<typeof repository>;
  let assetTypeVariableRepository: ReturnType<typeof repository>;
  let assetVariableRepository: ReturnType<typeof repository>;
  let service: VariableDefinitionService;

  beforeEach(() => {
    variableRepository = repository();
    assetTypeVariableRepository = repository();
    assetVariableRepository = repository();
    service = new VariableDefinitionService(
      variableRepository as never,
      assetTypeVariableRepository as never,
      assetVariableRepository as never,
    );
  });

  it('rejects a create DTO without unit', async () => {
    const dto = Object.assign(new CreateVariableDefinitionDto(), {
      name: 'temperature',
      dataType: 'FLOAT',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'unit')).toBe(true);
  });

  it('rejects duplicate names on create', async () => {
    variableRepository.findOne.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create({
        name: 'temperature',
        dataType: 'FLOAT',
        unit: 'C',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates and retrieves a variable definition', async () => {
    const variable = {
      id: 'variable-id',
      name: 'temperature',
      dataType: 'FLOAT',
      unit: 'C',
    } as VariableDefinition;
    variableRepository.findOne.mockResolvedValue(variable);

    await expect(
      service.update('variable-id', { description: 'Motor temperature' }),
    ).resolves.toMatchObject({ description: 'Motor temperature' });
    await expect(service.getById('variable-id')).resolves.toBe(variable);
  });

  it('protects deletion when the variable is referenced', async () => {
    variableRepository.findOne.mockResolvedValue({
      id: 'variable-id',
      name: 'temperature',
    });
    assetTypeVariableRepository.count.mockResolvedValue(1);
    assetVariableRepository.count.mockResolvedValue(0);

    await expect(service.remove('variable-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(variableRepository.remove).not.toHaveBeenCalled();
  });

  it('returns not found for a missing variable', async () => {
    variableRepository.findOne.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
