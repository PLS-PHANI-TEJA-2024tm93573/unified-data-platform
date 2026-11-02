export interface AssetType {
  id: string;
  name: string;
}

export interface AssetChildren {
  id: string;
  name: string;
  createdAt: string | Date;
  assetType: AssetType;
}