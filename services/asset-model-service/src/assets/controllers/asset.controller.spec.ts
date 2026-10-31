import { AssetController } from './asset.controller';

describe('AssetController', () => {
  it('exposes the asset hierarchy through the REST controller', async () => {
    const assetService = {
      getAssetHierarchy: jest.fn().mockResolvedValue({
        roots: [],
      }),
    };

    const controller = new AssetController(assetService as any);

    await expect(controller.getAssetHierarchy()).resolves.toEqual({
      roots: [],
    });
    expect(assetService.getAssetHierarchy).toHaveBeenCalledTimes(1);
  });
});
