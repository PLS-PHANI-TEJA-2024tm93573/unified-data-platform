import { Controller } from "@nestjs/common";
import { AssetService } from "../services/asset.service";
import { GrpcMethod } from "@nestjs/microservices";


@Controller()
export class AssetGrpcController {

    constructor(private readonly assetService: AssetService) {}

    @GrpcMethod('AssetModelService','GetAssetHierarchy')
    async getAssetHierarchy() {
        return this.assetService.getAssetHierarchy();
    }
    
}