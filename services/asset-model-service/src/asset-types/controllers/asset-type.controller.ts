import { Body, Controller , Get, Param, Post, Query } from '@nestjs/common';
import { CreateAssetTypeDto } from '../dto/create-asset-type.dto';
import { AssetTypeService } from '../services/asset-type.service';
import { filter } from 'rxjs';
import { GetAssetTypesQueryDto } from '../dto/get-asset-types-query.dto';



@Controller('asset-types')
export class AssetTypeController {

    constructor(
        private readonly assetTypeService: AssetTypeService
    ) {}

    @Post()
    create(@Body() dto: CreateAssetTypeDto ) {
        return this.assetTypeService.create(dto);
    }

    @Get()
    getAllAssetTypes(
        // @Query() query: GetAssetTypesQueryDto

    ) {
        return this.assetTypeService.getAllAssetTypes()
    }

    @Get(':id')
    getAssetTypeById(@Param('id') id: string){
        return this.assetTypeService.getAssetTypeById(id)
    }


}