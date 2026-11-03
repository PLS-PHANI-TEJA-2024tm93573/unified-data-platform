import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { VariableDefinition } from '../entities/variable-definition.entity';
import { Repository } from 'typeorm';
import { CreateVariableDefinitionDto } from '../dto/create-variable-definition.dto';
import { UpdateVariableDefinitionDto } from '../dto/update-variable-definition.dto';
import { AssetTypeVariable } from '../../asset-types/entities/asset-type-variable.entity';
import { AssetVariable } from '../../assets/entities/asset-variable.entity';
import { MetadataChangeDetectorService } from '../../metadata/metadata-change-detector.service';

@Injectable()
export class VariableDefinitionService {
  constructor(
    @InjectRepository(VariableDefinition)
    private readonly variableDefinitionRepository: Repository<VariableDefinition>,

    @InjectRepository(AssetTypeVariable)
    private readonly assetTypeVariableRepository: Repository<AssetTypeVariable>,

    @InjectRepository(AssetVariable)
    private readonly assetVariableRepository: Repository<AssetVariable>,
    private readonly metadataChanges: MetadataChangeDetectorService,
  ) {}

  async create(dto: CreateVariableDefinitionDto): Promise<VariableDefinition> {
    const existinVariableDefinition =
      await this.variableDefinitionRepository.findOne({
        where: {
          name: dto.name,
        },
      });

    if (existinVariableDefinition) {
      throw new ConflictException(
        `Variable definition '${dto.name} already exists`,
      );
    }
    const variableDefinition = this.variableDefinitionRepository.create(dto);

    const saved =
      await this.variableDefinitionRepository.save(variableDefinition);
    this.metadataChanges.markChanged();
    return saved;
  }

  getAll(): Promise<VariableDefinition[]> {
    return this.variableDefinitionRepository.find();
  }

  async getById(id: string): Promise<VariableDefinition> {
    const variableDefinition = await this.variableDefinitionRepository.findOne({
      where: { id },
    });

    if (!variableDefinition) {
      throw new NotFoundException(
        `Variable definition with id '${id}' not found`,
      );
    }

    return variableDefinition;
  }

  async update(
    id: string,
    dto: UpdateVariableDefinitionDto,
  ): Promise<VariableDefinition> {
    const variableDefinition = await this.getById(id);

    if (dto.name && dto.name !== variableDefinition.name) {
      const existingVariableDefinition =
        await this.variableDefinitionRepository.findOne({
          where: { name: dto.name },
        });

      if (existingVariableDefinition) {
        throw new ConflictException(
          `Variable definition '${dto.name}' already exists`,
        );
      }
    }

    const changed = Object.entries(dto).some(
      ([key, value]) => variableDefinition[key] !== value,
    );
    if (!changed) return variableDefinition;
    Object.assign(variableDefinition, dto);
    const saved =
      await this.variableDefinitionRepository.save(variableDefinition);
    this.metadataChanges.markChanged();
    return saved;
  }

  async remove(id: string): Promise<{ message: string }> {
    const variableDefinition = await this.getById(id);
    const [assetTypeCount, assetCount] = await Promise.all([
      this.assetTypeVariableRepository.count({
        where: { variableDefinition: { id } },
      }),
      this.assetVariableRepository.count({
        where: { variableDefinition: { id } },
      }),
    ]);

    if (assetTypeCount > 0 || assetCount > 0) {
      throw new ConflictException(
        `Variable definition '${variableDefinition.name}' cannot be deleted while it is referenced`,
      );
    }

    await this.variableDefinitionRepository.remove(variableDefinition);
    this.metadataChanges.markChanged();
    return {
      message: `Variable definition '${variableDefinition.name}' deleted`,
    };
  }
}
