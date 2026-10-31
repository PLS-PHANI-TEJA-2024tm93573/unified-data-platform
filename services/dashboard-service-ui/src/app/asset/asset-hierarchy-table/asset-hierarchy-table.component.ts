import { Component, OnInit } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { AssetService } from 'src/app/services/asset-service.service';

@Component({
  selector: 'app-asset-hierarchy-table',
  standalone: false,
  templateUrl: './asset-hierarchy-table.component.html',
  styleUrl: './asset-hierarchy-table.component.scss'
})
export class AssetHierarchyTableComponent implements OnInit {

  assetHierarchy: TreeNode[] = []
  isVariableDialogVisible: boolean = false;
  selectedAssetName = ''
  selectedAssetVariables: any[] = [];

  constructor( private readonly assetService: AssetService){

  }


  ngOnInit(): void {
    this.assetService.getAssetHierarchy().subscribe((response)=>{
      this.assetHierarchy = [...response]
    })
  }

  // assetHierarchy: TreeNode[] = [
  //   {
  //     data: { name: 'Texas Plant 01', status: 'Active', location: 'Austin, TX' },
  //     expanded: true,
  //     children: [
  //       {
  //         data: { name: 'Assembly Line A', status: 'Running', location: 'Bay 1' },
  //         expanded:true,
  //         children: [
  //           {
  //             data: { name: 'Robotic Arm #4', status: 'Warning', location: 'Station 12' }
  //           }
  //         ]
  //       }
  //     ]
  //   }
  // ];

  // Call this after receiving your data from an API service
  // collapseAllNodes(nodes: TreeNode[]): void {
  //   nodes.forEach(node => {
  //     node.expanded = false;
  //     if (node.children && node.children.length > 0) {
  //       this.collapseAllNodes(node.children);
  //     }
  //   });
  // }

  expandAll(): void {
    this.assetHierarchy.forEach(node => this.setExpansionRecursive(node, true));
    // Trigger change detection by creating a new array reference if necessary
    this.assetHierarchy = [...this.assetHierarchy];
  }

  collapseAll(): void {
    this.assetHierarchy.forEach(node => this.setExpansionRecursive(node, false));
    this.assetHierarchy = [...this.assetHierarchy];
  }


  openVariablesModal(assetId: string, assetName: string) {
    console.log( assetId);
    this.isVariableDialogVisible = true;
    this.selectedAssetName = assetName;
    this.assetService.getVaraiblesbyAssetId(assetId).subscribe((response)=>{
      this.selectedAssetVariables = [...response]
    })
  }

  private setExpansionRecursive(node: TreeNode, isExpanded: boolean): void {
    node.expanded = isExpanded;
    if (node.children) {
      node.children.forEach(child => this.setExpansionRecursive(child, isExpanded));
    }
  }
}
