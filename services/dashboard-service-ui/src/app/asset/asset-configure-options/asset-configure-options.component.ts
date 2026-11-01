import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AssetService } from 'src/app/services/asset-service.service';
import { AssetDetails } from 'src/interfaces/asset-details';

@Component({
  selector: 'app-asset-configure-options',
  standalone: false,
  templateUrl: './asset-configure-options.component.html',
  styleUrl: './asset-configure-options.component.scss'
})
export class AssetConfigureOptionsComponent implements OnInit {

  assetId: string ='';
  assetDetails!: AssetDetails;

  constructor(
      private route: ActivatedRoute,
      private readonly assetService: AssetService
    ){

  }

  ngOnInit(): void {
    this.assetId = this.route.snapshot.paramMap.get('id') ?? '';
    this.assetService.getAssetDetails(this.assetId).subscribe((response)=>{
      this.assetService.getVaraiblesbyAssetId(this.assetId).subscribe((variablesResponse)=>{
        this.assetDetails = response;
        this.assetDetails.variables = variablesResponse
        console.log(this.assetDetails)
      })
    });

    
  }


}
