export interface AssetDetails {
  id: string;
  name: string;
  assetType: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
  parentAsset?: {
    id: string;
    name: string;
    description: string;
    location: unknown | null;
    metadata: unknown | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  description: string;
  location: unknown | null;
  metadata: unknown | null;
  createdAt: string;
  updatedAt: string;
  variables:any
}