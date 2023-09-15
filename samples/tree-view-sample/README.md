# Tree View Sample

Demonstrates adding a new tree view to Zowe Explorer alongside data sets, USS, and jobs.

The `contributes` section of "package.json" defines a tree view named "Profiles" that will show inside the Zowe Explorer sidebar panel.

In "extension.ts" the tree view is configured to use [`ProfilesTreeProvider`](/samples/tree-view-sample/src/ProfilesTreeProvider.ts) as a data provider which retrieves a list of available Zowe profiles.

## Running the sample

- Open this sample in VS Code
- `yarn`
- `yarn run compile`
- `F5` to start debugging
