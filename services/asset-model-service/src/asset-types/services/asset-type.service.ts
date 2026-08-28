import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AssetType } from '../entities/asset-type.entity';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAssetTypeDto } from '../dto/create-asset-type.dto';
import { GetAssetTypesQueryDto } from '../dto/get-asset-types-query.dto';
import { AssetTypeVariable } from '../entities/asset-type-variable.entity';
import { VariableDefinition } from '../../variables/entities/variable-definition.entity';
import { AddAssetTypeVariableDto } from '../dto/add-asset-type-variable.dto';
import { UpdateAssetTypeDto } from '../dto/update-asset-type.dto';
import { Asset } from '../../assets/entities/asset.entity';
import { AssetVariable } from '../../assets/entities/asset-variable.entity';

@Injectable()
export class AssetTypeService {
  constructor(
    @InjectRepository(AssetType)
    private readonly assetTypeRepository: Repository<AssetType>,

    @InjectRepository(AssetTypeVariable)
    private readonly assetTypeVariableRepository: Repository<AssetTypeVariable>,

    @InjectRepository(VariableDefinition)
    private readonly varaibleDefinitionRepository: Repository<VariableDefinition>,

    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,

    @InjectRepository(AssetVariable)
    private readonly assetVariableRepository: Repository<AssetVariable>,
  ) {}

  async create(dto: CreateAssetTypeDto): Promise<AssetType> {
    const existingAssetType = await this.assetTypeRepository.findOne({
      where: {
        name: dto.name,
      },
    });

    if (existingAssetType) {
      throw new ConflictException(`Asset type '${dto.name}' already exists`);
    }

    const assetType = this.assetTypeRepository.create(dto);

    return this.assetTypeRepository.save(assetType);
  }

  getAllAssetTypes() {
    return this.assetTypeRepository.find();
  }

  async getAssetTypeById(id: string): Promise<AssetType> {
    const assetType = await this.assetTypeRepository.findOne({
      where: { id },
    });

    if (!assetType) {
      throw new NotFoundException(`Asset type with id '${id}' not found`);
    }

    return assetType;
  }

  async update(id: string, dto: UpdateAssetTypeDto): Promise<AssetType> {
    const assetType = await this.getAssetTypeById(id);

    if (dto.name && dto.name !== assetType.name) {
      const existingAssetType = await this.assetTypeRepository.findOne({
        where: { name: dto.name },
      });

      if (existingAssetType) {
        throw new ConflictException(`Asset type '${dto.name}' already exists`);
      }
    }

    Object.assign(assetType, dto);
    return this.assetTypeRepository.save(assetType);
  }

  async remove(id: string): Promise<{ message: string }> {
    const assetType = await this.getAssetTypeById(id);
    const [assetCount, associationCount] = await Promise.all([
      this.assetRepository.count({ where: { assetType: { id } } }),
      this.assetTypeVariableRepository.count({ where: { assetType: { id } } }),
    ]);

    if (assetCount > 0 || associationCount > 0) {
      throw new ConflictException(
        `Asset type '${assetType.name}' cannot be deleted while it has related assets or variables`,
      );
    }

    await this.assetTypeRepository.remove(assetType);
    return { message: `Asset type '${assetType.name}' deleted` };
  }

  async addVariable(
    assetTypeId: string,
    dto: AddAssetTypeVariableDto,
  ): Promise<AssetTypeVariable> {
    const assetType = await this.assetTypeRepository.findOne({
      where: { id: assetTypeId },
    });
    if (!assetType) {
      throw new NotFoundException(
        `Asset Type With id '${assetTypeId}' not found`,
      );
    }

    const variableDefinition = await this.varaibleDefinitionRepository.findOne({
      where: { id: dto.variableDefinitionId },
    });
    if (!variableDefinition) {
      throw new NotFoundException(
        `Variable Definition with id '${dto.variableDefinitionId} not found`,
      );
    }

    const existingAssociation = await this.assetTypeVariableRepository.findOne({
      where: {
        assetType: {
          id: assetTypeId,
        },
        variableDefinition: {
          id: dto.variableDefinitionId,
        },
      },
    });

    if (existingAssociation) {
      throw new ConflictException(
        `Variable '${variableDefinition.name}' is already associated with asset type '${assetType.name}'`,
      );
    }

    const assetTypeVariable = this.assetTypeVariableRepository.create({
      assetType,
      variableDefinition,
      required: dto.required,
    });

    return this.assetTypeVariableRepository.save(assetTypeVariable);
  }

  async removeVariable(assetTypeId: string, variableDefintionId: string) {
    const association = await this.assetTypeVariableRepository.findOne({
      where: {
        assetType: {
          id: assetTypeId,
        },
        variableDefinition: {
          id: variableDefintionId,
        },
      },
    });

    if (!association) {
      throw new NotFoundException('Asset type variable association not found');
    }

    const dependentAssetVariable = await this.assetVariableRepository.findOne({
      where: {
        variableDefinition: { id: variableDefintionId },
        asset: { assetType: { id: assetTypeId } },
      },
    });

    if (dependentAssetVariable) {
      throw new ConflictException(
        'Variable cannot be removed because assets of this type use it',
      );
    }

    await this.assetTypeVariableRepository.remove(association);
    return { message: 'Asset type variable association deleted' };
  }

  async getVariables(assetTypeId: string) {
    const assetType = await this.assetTypeRepository.findOne({
      where: {
        id: assetTypeId,
      },
    });

    if (!assetType) {
      throw new NotFoundException(
        `Asset type with id '${assetTypeId}' not found`,
      );
    }

    return this.assetTypeVariableRepository.find({
      where: {
        assetType: {
          id: assetTypeId,
        },
      },
      relations: {
        variableDefinition: true,
      },
    });
  }
}
