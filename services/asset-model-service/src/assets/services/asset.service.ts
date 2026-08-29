import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Asset } from '../entities/asset.entity';
import { AssetType } from '../../asset-types/entities/asset-type.entity';
import { CreateAssetDto } from '../dto/create-asset.dto';
import { AssetVariable } from '../entities/asset-variable.entity';
import { VariableDefinition } from '../../variables/entities/variable-definition.entity';
import { AssetTypeVariable } from '../../asset-types/entities/asset-type-variable.entity';
import { AddAssetVariableDto } from '../dto/add-asset-varaible.dto';
import { UpdateAssetDto } from '../dto/update-asset.dto';

@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,

    @InjectRepository(AssetType)
    private readonly assetTypeRepository: Repository<AssetType>,

    @InjectRepository(AssetVariable)
    private readonly assetVariableRepository: Repository<AssetVariable>,

    @InjectRepository(VariableDefinition)
    private readonly variableDefinitionRepository: Repository<VariableDefinition>,

    @InjectRepository(AssetTypeVariable)
    private readonly assetTypeVariableRepository: Repository<AssetTypeVariable>,
  ) {}

  async create(dto: CreateAssetDto): Promise<Asset> {
    const assetType = await this.assetTypeRepository.findOne({
      where: {
        id: dto.assetTypeId,
      },
    });

    if (!assetType) {
      throw new NotFoundException(
        `Asset type with id '${dto.assetTypeId}' not found`,
      );
    }

    let parentAsset: Asset | undefined;

    if (dto.parentAssetId) {
      parentAsset =
        (await this.assetRepository.findOne({
          where: {
            id: dto.parentAssetId,
          },
        })) ?? undefined;

      if (!parentAsset) {
        throw new NotFoundException(
          `Parent asset with id '${dto.parentAssetId}' not found`,
        );
      }
    }

    const asset = this.assetRepository.create({
      name: dto.name,
      assetType,
      description: dto.description,
      location: dto.location,
      metadata: dto.metadata,
      parentAsset,
    });

    return this.assetRepository.save(asset);
  }

  async getAllAssets(): Promise<Asset[]> {
    return this.assetRepository.find({
      relations: {
        assetType: true,
        parentAsset: true,
      },
    });
  }

  async getAssetById(id: string): Promise<Asset> {
    const asset = await this.assetRepository.findOne({
      where: {
        id,
      },
      relations: {
        assetType: true,
        parentAsset: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with id '${id}' not found`);
    }

    return asset;
  }

  async getVariables(assetId: string): Promise<AssetVariable[]> {
    const asset = await this.assetRepository.findOne({
      where: {
        id: assetId,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with id '${assetId}' not found`);
    }

    return this.assetVariableRepository.find({
      where: {
        asset: {
          id: assetId,
        },
      },
      relations: {
        variableDefinition: true,
      },
    });
  }

  async update(id: string, dto: UpdateAssetDto): Promise<Asset> {
    const asset = await this.assetRepository.findOne({
      where: { id },
      relations: { assetType: true },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with id '${id}' not found`);
    }

    if (dto.assetTypeId && dto.assetTypeId !== asset.assetType.id) {
      const assetType = await this.assetTypeRepository.findOne({
        where: { id: dto.assetTypeId },
      });

      if (!assetType) {
        throw new NotFoundException(
          `Asset type with id '${dto.assetTypeId}' not found`,
        );
      }

      const [assignedVariables, allowedVariables] = await Promise.all([
        this.assetVariableRepository.find({
          where: { asset: { id } },
          relations: { variableDefinition: true },
        }),
        this.assetTypeVariableRepository.find({
          where: { assetType: { id: dto.assetTypeId } },
          relations: { variableDefinition: true },
        }),
      ]);
      const allowedVariableIds = new Set(
        allowedVariables.map(({ variableDefinition }) => variableDefinition.id),
      );
      const incompatibleVariable = assignedVariables.find(
        ({ variableDefinition }) =>
          !allowedVariableIds.has(variableDefinition.id),
      );

      if (incompatibleVariable) {
        throw new ConflictException(
          `Asset cannot change type because variable '${incompatibleVariable.variableDefinition.name}' is not defined for the new asset type`,
        );
      }

      asset.assetType = assetType;
    }

    if (dto.parentAssetId !== undefined) {
      if (dto.parentAssetId === id) {
        throw new BadRequestException('An asset cannot be its own parent');
      }

      const parentAsset = await this.assetRepository.findOne({
        where: { id: dto.parentAssetId },
      });

      if (!parentAsset) {
        throw new NotFoundException(
          `Parent asset with id '${dto.parentAssetId}' not found`,
        );
      }

      asset.parentAsset = parentAsset;
    }

    if (dto.name !== undefined) asset.name = dto.name;
    if (dto.description !== undefined) asset.description = dto.description;
    if (dto.location !== undefined) asset.location = dto.location;
    if (dto.metadata !== undefined) asset.metadata = dto.metadata;

    return this.assetRepository.save(asset);
  }

  async remove(id: string): Promise<{ message: string }> {
    const asset = await this.assetRepository.findOne({ where: { id } });

    if (!asset) {
      throw new NotFoundException(`Asset with id '${id}' not found`);
    }

    const [childCount, variableCount] = await Promise.all([
      this.assetRepository.count({ where: { parentAsset: { id } } }),
      this.assetVariableRepository.count({ where: { asset: { id } } }),
    ]);

    if (childCount > 0 || variableCount > 0) {
      throw new ConflictException(
        `Asset '${asset.name}' cannot be deleted while it has child assets or assigned variables`,
      );
    }

    await this.assetRepository.remove(asset);
    return { message: `Asset '${asset.name}' deleted` };
  }

  async addVariable(
    assetId: string,
    dto: AddAssetVariableDto,
  ): Promise<AssetVariable> {
    const asset = await this.assetRepository.findOne({
      where: {
        id: assetId,
      },
      relations: {
        assetType: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with id '${assetId}' not found`);
    }

    const variableDefinition = await this.variableDefinitionRepository.findOne({
      where: {
        id: dto.variableDefinitionId,
      },
    });

    if (!variableDefinition) {
      throw new NotFoundException(
        `Variable definition with id '${dto.variableDefinitionId}' not found`,
      );
    }

    const assetTypeVariable = await this.assetTypeVariableRepository.findOne({
      where: {
        assetType: {
          id: asset.assetType.id,
        },
        variableDefinition: {
          id: variableDefinition.id,
        },
      },
    });

    if (!assetTypeVariable) {
      throw new ConflictException(
        `Variable '${variableDefinition.name}' is not defined for asset type '${asset.assetType.name}'`,
      );
    }

    const existingAssetVariable = await this.assetVariableRepository.findOne({
      where: {
        asset: {
          id: asset.id,
        },
        variableDefinition: {
          id: variableDefinition.id,
        },
      },
    });

    if (existingAssetVariable) {
      throw new ConflictException(
        `Variable '${variableDefinition.name}' is already assigned to asset '${asset.name}'`,
      );
    }

    const assetVariable = this.assetVariableRepository.create({
      asset,
      variableDefinition,
      isCustom: false,
    });

    return this.assetVariableRepository.save(assetVariable);
  }

  async removeVariable(
    assetId: string,
    variableDefinitionId: string,
  ): Promise<{ message: string }> {
    const asset = await this.assetRepository.findOne({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with id '${assetId}' not found`);
    }

    const assetVariable = await this.assetVariableRepository.findOne({
      where: {
        asset: { id: assetId },
        variableDefinition: { id: variableDefinitionId },
      },
    });

    if (!assetVariable) {
      throw new NotFoundException('Asset variable association not found');
    }

    await this.assetVariableRepository.remove(assetVariable);
    return { message: 'Asset variable association deleted' };
  }
}
