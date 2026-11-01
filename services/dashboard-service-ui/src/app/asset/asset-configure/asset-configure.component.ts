import { Component, OnInit } from '@angular/core';
import { AssetService } from 'src/app/services/asset-service.service';
import { TreeNode } from 'primeng/api';
import { Router } from '@angular/router';

@Component({
  selector: 'app-asset-configure',
  standalone: false,
  templateUrl: './asset-configure.component.html',
  styleUrl: './asset-configure.component.scss'
})
export class AssetConfigureComponent implements OnInit {

  assetTreeHierarchy: TreeNode[] = []
  isVariableDialogVisible: boolean = false;
  selectedAssetName = ''
  selectedAssetVariables: any[] = [];

  constructor(
    private readonly assetService: AssetService,
    private readonly router: Router
  ) { }

  ngOnInit(): void {
    this.assetService.getAssetHierarchy().subscribe((response)=>{
      this.assetTreeHierarchy = [...response]
    })
  }


    openVariablesModal(assetId: string, assetName: string) {
    console.log( assetId);
    this.isVariableDialogVisible = true;
    this.selectedAssetName = assetName;
    this.assetService.getVaraiblesbyAssetId(assetId).subscribe((response)=>{
      this.selectedAssetVariables = [...response]
    })
  }


  configureAsset(assetId: string ) {
    this.router.navigate(['/asset/configure',assetId])
  }




  }


