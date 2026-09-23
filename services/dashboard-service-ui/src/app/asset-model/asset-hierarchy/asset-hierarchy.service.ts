import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface AssetType {
  id: string;
  name: string;
}

export interface AssetVariable {
  id: string;
  name: string;
  data_type: string;
  unit?: string;
}

export interface AssetNode {
  id: string;
  name: string;
  asset_type: AssetType;
  variables: AssetVariable[];
  children: AssetNode[];
  details?: AssetVariable;
  isVariableNode?: boolean;
}

export interface AssetHierarchyResponse {
  roots: AssetNode[];
}

interface ApiAssetType {
  id: string;
  name: string;
}

interface ApiAssetVariable {
  id: string;
  name: string;
  dataType: string;
  unit?: string;
}

interface ApiAssetNode {
  id: string;
  name: string;
  assetType: ApiAssetType;
  variables: ApiAssetVariable[];
  children: ApiAssetNode[];
}

interface ApiAssetHierarchyResponse {
  roots: ApiAssetNode[];
}

@Injectable({
  providedIn: 'root',
})
export class AssetHierarchyService {
  private readonly apiUrl = 'http://localhost:3000/assets/hierarchy';

  constructor(private readonly http: HttpClient) {}

  getAssetHierarchy(): Observable<AssetHierarchyResponse> {
    return this.http.get<ApiAssetHierarchyResponse>(this.apiUrl).pipe(
      map((response) => this.normalizeHierarchy(response)),
    );
  }

  private normalizeHierarchy(response: ApiAssetHierarchyResponse): AssetHierarchyResponse {
    return {
      roots: (response.roots ?? []).map((node) => this.normalizeNode(node)),
    };
  }

  private normalizeNode(node: ApiAssetNode): AssetNode {
    const normalizedVariables = (node.variables ?? []).map((variable) => ({
      id: variable.id,
      name: variable.name,
      data_type: variable.dataType,
      unit: variable.unit,
    }));

    const variableNodes: AssetNode[] = normalizedVariables.map((variable) => ({
      id: variable.id,
      name: variable.name,
      asset_type: {
        id: variable.id,
        name: 'VARIABLE',
      },
      variables: [],
      children: [],
      details: variable,
      isVariableNode: true,
    }));

    return {
      id: node.id,
      name: node.name,
      asset_type: {
        id: node.assetType.id,
        name: node.assetType.name,
      },
      variables: normalizedVariables,
      children: [
        ...(node.children ?? []).map((child) => this.normalizeNode(child)),
        ...variableNodes,
      ],
    };
  }
}
