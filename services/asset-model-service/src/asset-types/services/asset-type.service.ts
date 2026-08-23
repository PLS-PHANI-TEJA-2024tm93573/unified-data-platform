import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { AssetType } from "../entities/asset-type.entity";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CreateAssetTypeDto } from "../dto/create-asset-type.dto";
import { GetAssetTypesQueryDto } from "../dto/get-asset-types-query.dto";


@Injectable()
export class AssetTypeService {

  constructor(
    @InjectRepository(AssetType)
    private readonly assetTypeRepository: Repository<AssetType>
  ) { }

  
  async create(dto: CreateAssetTypeDto): Promise<AssetType> {

    const existingAssetType = await this.assetTypeRepository.findOne({
      where: {
        name: dto.name,
      },
    });

    if (existingAssetType) {
      throw new ConflictException(
        `Asset type '${dto.name}' already exists`,
      );
    }

    const assetType = this.assetTypeRepository.create(dto);

    return this.assetTypeRepository.save(assetType);
  }


  getAllAssetTypes(){

    return this.assetTypeRepository.find();
  }

  async getAssetTypeById(id: string): Promise<AssetType> {
    const assetType = await this.assetTypeRepository.findOne({
      where: { id }
    });

    if (!assetType) {
      throw new NotFoundException(
        `Asset type with id '${id}' not found`
      );}

    return assetType;

  }


}