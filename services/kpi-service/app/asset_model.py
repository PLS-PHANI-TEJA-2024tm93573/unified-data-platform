"""Load KPI asset and telemetry IDs from the Asset Model Service."""

import httpx

from .config import settings
from .oee import ENABLED_ASSETS


def _walk(nodes: list[dict]):
    for node in nodes:
        # The OpenAPI contract uses AssetHierarchyNode directly. The currently
        # deployed controller wraps those nodes in PrimeNG tree-table objects.
        yield node.get("data") or node
        yield from _walk(node.get("children") or [])


async def load_asset_config(client: httpx.AsyncClient) -> dict[str, dict]:
    """Build runtime config for enabled assets from Asset Model metadata."""
    hierarchy_response = await client.get("/assets/hierarchy")
    hierarchy_response.raise_for_status()
    hierarchy = hierarchy_response.json()
    roots = hierarchy.get("roots") if isinstance(hierarchy, dict) else hierarchy
    if not isinstance(roots, list):
        raise ValueError("Asset Model /assets/hierarchy returned an unexpected response")

    hierarchy_assets = {
        asset.get("name"): asset
        for asset in _walk(roots)
        if asset.get("name") in ENABLED_ASSETS
    }
    existing = settings.assets
    configured: dict[str, dict] = {}
    for name in sorted(ENABLED_ASSETS):
        asset = hierarchy_assets.get(name)
        if not asset or not asset.get("id"):
            raise ValueError(f"Asset Model hierarchy does not contain enabled KPI asset {name}")

        # The hierarchy endpoint returns variable-definition IDs. The measurements
        # API requires the assignment IDs returned by this asset-specific endpoint.
        variables_response = await client.get(f"/assets/{asset['id']}/variables")
        variables_response.raise_for_status()
        assignments = variables_response.json()
        variables = {
            assignment["variableDefinition"]["name"]: assignment["id"]
            for assignment in assignments
            if assignment.get("id") and assignment.get("variableDefinition", {}).get("name")
        }
        configured[name] = {
            **existing.get(name, {}),
            "asset_id": asset["id"],
            "variables": variables,
        }
    return configured


async def synchronize_asset_config() -> None:
    """Fetch Asset Model metadata and replace the in-memory KPI configuration."""
    async with httpx.AsyncClient(base_url=settings.asset_model_url.rstrip("/"), timeout=20.0) as client:
        settings.replace_assets(await load_asset_config(client))
