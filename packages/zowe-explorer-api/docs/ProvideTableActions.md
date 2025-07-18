# Providing Actions to Shared Tables

This guide explains how to extend shared, core table views in Zowe Explorer by registering table action providers.

## Overview

Zowe Explorer provides a registry system that allows extenders to contribute actions and context menu items to built-in table views. This is accomplished through the `TableProviderRegistry` and the `TableActionProvider` interface.

## Core Components

### Table Context Namespace (`Table.Context`)

All table context types are organized under the `Table.Context` namespace:

- **`Table.Context.Identifiers`** - Built-in table identifiers enum
- **`Table.Context.DataSet`** - Context for data set tables
- **`Table.Context.Job`** - Context for job tables
- **`Table.Context.Search`** - Context for search result tables
- **Type guards and helpers** - Functions like `isDataSet()`, `isSearch()`, etc.

### TableActionProvider Interface

```typescript
import { Table, TableActionProvider } from "@zowe/zowe-explorer-api";

export interface TableActionProvider {
  provideActions(context: Table.Context.IBaseData): Table.Action[] | Promise<Table.Action[]>;
  provideContextMenuItems?(context: Table.Context.IBaseData): Table.ContextMenuOption[] | Promise<Table.ContextMenuOption[]>;
}
```

## Basic Usage

### 1. Implement TableActionProvider

```typescript
import { Table, TableActionProvider } from "@zowe/zowe-explorer-api";

export class MyTableActionProvider implements TableActionProvider {
  provideActions(context: Table.Context.IBaseData): Table.Action[] {
    const actions: Table.Action[] = [];

    // Add actions based on table context
    if (Table.Context.isDataSet(context)) {
      actions.push({
        title: "Custom Data Set Action",
        command: "my-extension.customDatasetAction",
        callback: {
          typ: "single-row",
          fn: this.handleDatasetAction.bind(this),
        },
      });
    }

    return actions;
  }

  provideContextMenuItems(context: Table.Context.IBaseData): Table.ContextMenuOption[] {
    const items: Table.ContextMenuOption[] = [];

    if (Table.Context.isDataSet(context)) {
      items.push({
        title: "Custom Context Menu Item",
        command: "my-extension.customContextAction",
        callback: {
          typ: "single-row",
          fn: this.handleContextAction.bind(this),
        },
      });
    }

    return items;
  }

  private handleDatasetAction(view: Table.View, row: Table.RowInfo): void {
    // Handle the action
  }

  private handleContextAction(view: Table.View, row: Table.RowInfo): void {
    // Handle the context menu action
  }
}
```

### 2. Register Your Provider

```typescript
import { ZoweExplorerExtender } from "@zowe/zowe-explorer-api";

export function activate(context: vscode.ExtensionContext) {
  const extender = ZoweExplorerExtender.createInstance(context);
  const provider = new MyTableActionProvider();

  // Register for built-in tables using enum values
  extender.registerTableActionProvider(Table.Context.Identifiers.DATA_SETS, provider);
  extender.registerTableActionProvider(Table.Context.Identifiers.DATA_SET_MEMBERS, provider);

  // Or register for custom table IDs
  extender.registerTableActionProvider("my-custom-table", provider);
}
```

## Built-in Table Identifiers

```typescript
// Available in the Table.Context.Identifiers enum:
Table.Context.Identifiers.DATA_SETS; // "data-sets"
Table.Context.Identifiers.DATA_SET_MEMBERS; // "data-set-members"
Table.Context.Identifiers.JOBS; // "jobs"
Table.Context.Identifiers.SEARCH_RESULTS; // "search-results"
```

## Context Information

When your provider methods are called, they receive a `context` object with useful information. You can cast to the specific context type for better type safety:

```typescript
provideActions(context: Table.Context.IBaseData): Table.Action[] {
    // Use type guards for safe casting
    const datasetContext = Table.Context.getDataset(context);
    if (datasetContext) {
        // Type-safe access to context properties
        if (datasetContext?.profileName === "prod.zosmf") {
            actions.push({
                title: "Production Action",
                // ... action definition
            });
        }
    }

    return actions;
}

// Additional context types available, see the "Context" namespace in TableView.ts for more...
```

### Context Helper Functions

The `Table.Context` namespace provides utility functions for working with contexts:

```typescript
// Type guards
Table.Context.isDataSet(context); // Check if context is Dataset
Table.Context.isJob(context); // Check if context is Job
Table.Context.isSearch(context); // Check if context is Search

// Safe getters with type checking
Table.Context.getDataset(context); // Get Dataset context or undefined
Table.Context.getJob(context); // Get Job context or undefined
Table.Context.getSearch(context); // Get Search context or undefined

// Universal helpers
Table.Context.getProfile(context); // Get profile from any context
Table.Context.getProfileName(context); // Get profile name from any context
```

## Example

```typescript
export class AdvancedTableProvider implements TableActionProvider {
  provideActions(context: Table.Context.IBaseData): Table.Action[] {
    const actions: Table.Action[] = [];

    switch (context.tableId) {
      case Table.Context.Identifiers.DATA_SETS:
        const dataSetContext = Table.Context.getDataset(context);
        if (dataSetContext?.tableType === "dataSets") {
          actions.push({
            title: `Archive to ${dataSetContext.profileName}`,
            command: "my-ext.archiveDataset",
            condition: (row) => !row.migr || row.migr === "NO",
            callback: {
              typ: "multi-row",
              fn: this.archiveDataSets.bind(this),
            },
          });
        }
        break;

      case Table.Context.Identifiers.JOBS:
        actions.push({
          title: "Custom Job Action",
          command: "my-ext.customJobAction",
          callback: {
            typ: "single-row",
            fn: this.handleJobAction.bind(this),
          },
        });
        break;
    }

    return actions;
  }

  private archiveDataSets(view: Table.View, rows: Record<number, Table.RowData>): void {
    // Handle multiple data set archiving
  }

  private handleJobAction(view: Table.View, row: Table.RowInfo): void {
    // Handle job action
  }
}
```

## Custom Table IDs

For your own custom tables, you can use any string identifier:

```typescript
// In your table implementation... any type can be used, just using base data type as an example
const customContext: Table.Context.IBaseData = {
  tableId: "my-extension.custom-table",
  customProperty: "value",
};

// In your provider registration
extender.registerTableActionProvider("my-extension.custom-table", provider);
```
