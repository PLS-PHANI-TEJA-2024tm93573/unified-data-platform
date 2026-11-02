import { Controller } from "@nestjs/common";
import { AssetService } from "../services/asset.service";
import { GrpcMethod } from "@nestjs/microservices";


@Controller()
export class AssetGrpcController {

    constructor(private readonly assetService: AssetService) {}

    @GrpcMethod('AssetModelService','GetAssetHierarchy')
    async getAssetHierarchy() {
        const isGrpc = true;
        return this.assetService.getAssetHierarchy(isGrpc);
    }
    
}