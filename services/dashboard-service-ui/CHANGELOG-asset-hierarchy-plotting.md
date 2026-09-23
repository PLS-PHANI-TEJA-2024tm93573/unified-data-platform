# Asset hierarchy plotting changes

## Summary
- Added a graph action button for each variable detail row in the asset hierarchy tree.
- Added a modal dialog that opens from a variable row and allows a user to enter the plotting request values.
- Added a new plotting page under the asset module that receives query parameters and displays them in plain HTML for now.
- Added a variable ID field in the modal that is prefilled from the backend and disabled so it cannot be edited.
- Added validation so `to` cannot be earlier than `from`, and `limit` is constrained to 100-500 with a default of 100.
- Added a route at `/plotting` for the new sister component.

## Files changed
- `src/app/asset-model/asset-hierarchy/asset-hierarchy.html`
- `src/app/asset-model/asset-hierarchy/asset-hierarchy.scss`
- `src/app/asset-model/asset-hierarchy/asset-hierarchy.ts`
- `src/app/asset-model/asset-model-module.ts`
- `src/app/asset-model/asset-routing.module.ts`
- `src/app/asset-model/plotting/plotting.component.ts`
- `src/app/asset-model/plotting/plotting.component.html`
- `src/app/asset-model/plotting/plotting.component.scss`

## Revert guidance
- Remove the graph button markup and modal markup from the hierarchy template.
- Remove the `selectedVariableNode`, `variableGraphForm`, `openVariableGraphDialog`, `closeVariableGraphDialog`, `viewVariableGraph`, and date-range validation code from the hierarchy component.
- Remove the `ReactiveFormsModule` import and the `PlottingComponent` declaration/route if the feature is no longer needed.
- Delete the new plotting component files and revert the routing module entries.
