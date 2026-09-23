import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
  AssetHierarchyResponse,
  AssetHierarchyService,
  AssetNode,
} from './asset-hierarchy.service';

@Component({
  selector: 'app-asset-hierarchy',
  standalone: false,
  styleUrl: './asset-hierarchy.scss',
  templateUrl: './asset-hierarchy.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AssetHierarchy implements OnInit {
  assetHierarchy: AssetHierarchyResponse = { roots: [] };

  protected collapsedNodes = new Set<string>();
  protected isLoading = true;
  protected errorMessage: string | null = null;
  protected selectedVariableNode: AssetNode | null = null;
  protected variableGraphForm: FormGroup;

  constructor(
    private readonly hierarchyService: AssetHierarchyService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly router: Router,
  ) {
    this.variableGraphForm = this.fb.group(
      {
        variableId: [{ value: '', disabled: true }, Validators.required],
        from: ['', Validators.required],
        to: ['', Validators.required],
        limit: [100, [Validators.min(100), Validators.max(500)]],
      },
      {
        validators: [this.validateDateRange],
      },
    );
  }

  ngOnInit(): void {
    this.loadAssetHierarchy();
  }

  private loadAssetHierarchy(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.hierarchyService.getAssetHierarchy().subscribe({
      next: (assetHierarchy) => {
        console.log('Asset hierarchy loaded successfully:', assetHierarchy);
        this.assetHierarchy = assetHierarchy;
        this.collapsedNodes = new Set(this.getVariableNodeIds(this.assetHierarchy.roots));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        console.log('Error loading asset hierarchy');
        this.assetHierarchy = { roots: [] };
        this.collapsedNodes = new Set();
        this.errorMessage = 'Failed to load asset hierarchy. Please try again later.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  protected hasChildren(node: AssetNode): boolean {
    return !!node.children?.length;
  }

  protected isVariableNode(node: AssetNode): boolean {
    return !!node.isVariableNode;
  }

  protected isCollapsed(nodeId: string): boolean {
    return this.collapsedNodes.has(nodeId);
  }

  protected toggleNode(nodeId: string): void {
    if (this.collapsedNodes.has(nodeId)) {
      this.collapsedNodes.delete(nodeId);
      return;
    }

    this.collapsedNodes.add(nodeId);
  }

  protected openVariableGraphDialog(node: AssetNode): void {
    if (!node.details) {
      return;
    }

    this.selectedVariableNode = node;
    this.variableGraphForm.reset({
      variableId: node.details.id,
      from: '',
      to: '',
      limit: 100,
    });
    this.variableGraphForm.get('variableId')?.disable();
    this.variableGraphForm.markAsPristine();
    this.variableGraphForm.markAsUntouched();
  }

  protected closeVariableGraphDialog(): void {
    this.selectedVariableNode = null;
    this.variableGraphForm.reset();
    this.variableGraphForm.get('variableId')?.disable();
  }

  protected viewVariableGraph(): void {
    if (this.variableGraphForm.invalid) {
      this.variableGraphForm.markAllAsTouched();
      return;
    }

    const payload = this.variableGraphForm.getRawValue();

    this.router.navigate(['/plotting'], {
      queryParams: {
        variableId: payload.variableId,
        from: payload.from,
        to: payload.to,
        limit: payload.limit || 100,
      },
    });
  }

  private validateDateRange(group: FormGroup): ValidationErrors | null {
    const from = group.get('from')?.value;
    const to = group.get('to')?.value;

    if (!from || !to) {
      return null;
    }

    return new Date(to) < new Date(from) ? { dateRange: true } : null;
  }

  private getVariableNodeIds(nodes: AssetNode[]): string[] {
    return nodes.flatMap((node) => {
      const variableIds = node.isVariableNode ? [node.id] : [];
      return [...variableIds, ...this.getVariableNodeIds(node.children)];
    });
  }
}
