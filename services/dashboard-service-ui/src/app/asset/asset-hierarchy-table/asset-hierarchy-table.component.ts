import { Component } from '@angular/core';
import { TreeNode } from 'primeng/api';

@Component({
  selector: 'app-asset-hierarchy-table',
  standalone: false,
  templateUrl: './asset-hierarchy-table.component.html',
  styleUrl: './asset-hierarchy-table.component.scss'
})
export class AssetHierarchyTableComponent {
  assetHierarchy: TreeNode[] = [
    {
      data: { name: 'Texas Plant 01', status: 'Active', location: 'Austin, TX' },
      expanded: true,
      children: [
        {
          data: { name: 'Assembly Line A', status: 'Running', location: 'Bay 1' },
          expanded:true,
          children: [
            {
              data: { name: 'Robotic Arm #4', status: 'Warning', location: 'Station 12' }
            }
          ]
        }
      ]
    }
  ];

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

  private setExpansionRecursive(node: TreeNode, isExpanded: boolean): void {
    node.expanded = isExpanded;
    if (node.children) {
      node.children.forEach(child => this.setExpansionRecursive(child, isExpanded));
    }
  }
}
