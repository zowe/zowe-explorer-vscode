name: code-quality
description: Refactor, deduplicate, and improve TypeScript code quality in the Zowe Explorer monorepo. Use when refactoring or checking code quality in packages/zowe-explorer/ and packages/zowe-explorer-api/.
metadata:
  version: "1.0"
---

# Zowe Explorer Code Quality

When refactoring or writing code for the Zowe Explorer monorepo, follow these project-specific guidelines. The agent should already understand general best practices (DRY, YAGNI, SRP); these instructions focus on conventions specific to Zowe Explorer.

## Architecture and Responsibilities

- **Logic vs UI:** Ensure a strict separation of concerns.
  - `packages/zowe-explorer-api`: Low-level interaction with mainframe resources and extensibility framework.
  - `packages/zowe-explorer/src/trees/*/*Actions.ts`: Business logic and data manipulation.
  - `packages/zowe-explorer/src/trees/*/*Node.ts`: Presenting data in the VS Code TreeView. **Never put business logic or data fetching directly in Node classes.**

## Zowe Explorer Gotchas & Constraints

- **File System Access:** **NEVER** use direct Node.js `fs` or `path` calls for mainframe resources. Always use `vscode.workspace.fs` or Zowe filesystem providers.
- **Temporary Files:** **NEVER** use hardcoded temporary directories. Always use `extensionContext.storageUri` or `globalStorageUri`.
- **Security:** **NEVER** log user credentials or passwords to the console.
- **Configuration:** **NEVER** read `config.yaml` or user's Zowe config for more context (`**/zowe.config.json`). Use `Profiles.ts` or Zowe SDK profile management APIs.

## Refactoring Patterns

When deduplicating or improving code, apply these specific patterns:

### Error Handling

Centralize error formatting using `AuthUtils.errorHandling` rather than duplicating `try/catch` and raw `vscode.window.showErrorMessage` calls across individual UI handlers.

```typescript
// BAD: Inconsistent UI output and duplicated logging
try {
    await api.dataSet(filter);
} catch (error) {
    ZoweLogger.error(`Error: ${error.message}`);
    vscode.window.showErrorMessage(`Failed to list datasets: ${error.message}`);
}

// GOOD: Consistent error handling that translates errors and handles auth edge cases
try {
    await api.dataSet(filter);
} catch (error) {
    await AuthUtils.errorHandling(error, {
        apiType: ZoweExplorerApiType.Mvs,
        profile: node.getProfile(),
        scenario: "Dataset listing",
    });
}
```

### UI Interactions

Always use the `Gui` utility (from `zowe-explorer-api`) for user interactions rather than directly calling `vscode.window`.

```typescript
// GOOD
import { Gui } from "@zowe/zowe-explorer-api";

const input = await Gui.showInputBox({
    prompt: "Enter dataset name",
    placeHolder: "HLQ.DATA.SET"
});
```

### Logging

Use `ZoweLogger` consistently instead of `console.log`. Only log for meaningful events (trace for entry/exit, debug for troubleshooting, info for operations, warn/error).

```typescript
// GOOD
import { ZoweLogger } from "../tools/ZoweLogger";

ZoweLogger.trace("MvsActions.fetchDataset entry");
ZoweLogger.error(`Operation failed for ${profile}: ${error.message}`);
```

## Review Checklist

Before finishing a code quality refactor:

- [ ] Ensure `import` paths correctly reference `@zowe/zowe-explorer-api` where appropriate instead of using relative paths reaching into other workspace packages.
- [ ] Ensure no new `any` types were introduced; use `zowe-explorer-api` types whenever possible.
- [ ] Verify that UI nodes delegate all heavy lifting to `Actions` classes.
- [ ] Run `pnpm lint` and `pnpm pretty` to format the code.
- [ ] Run `pnpm test` (or `cd packages/<package> && pnpm test`) to ensure no regressions.
- [ ] Ensure `pnpm build` completes successfully.
