---
name: testing
description: Write and maintain Jest unit tests and WDIO/Cucumber end-to-end tests in the Zowe Explorer monorepo. Use when adding, updating, debugging, or reviewing tests, when working with `*.unit.test.ts` files, `__tests__/__unit__/` or `__tests__/__e2e__/` directories, `.feature` files, step definitions, page objects, mock factories (`mockCreators/`), `MockedProperty`, `jest-mock-vscode`, `jest.config`, `wdio.conf`, or running `pnpm test` / `pnpm test:e2e` in `packages/zowe-explorer/`, `packages/zowe-explorer-api/`, or `packages/zowe-explorer-ftp-extension/`.
metadata:
  version: "1.0"
---

# Zowe Explorer Testing

Guidance for writing and maintaining tests in the Zowe Explorer monorepo. This skill focuses on Zowe-Explorer-specific conventions, helpers, and gotchas.

## Gotchas

Read these before writing or modifying tests.

- **The `vscode` mock is mostly hand-rolled, not `jest-mock-vscode` wholesale.** `__tests__/__mocks__/vscode.ts` defines `MarkdownString`, `ProgressLocation`, `Uri`, `Range`, `WorkspaceEdit`, etc., by hand. Only a small subset (`FileSystemError`, `Selection`, `Position`, `ThemeIcon`, `CodeLensProvider`) is destructured from `require("jest-mock-vscode").createVSCodeMock(jest)`. If a needed VS Code class/value isn't exported, extend `__mocks__/vscode.ts` (either via manual definition or pulling more from `createVSCodeMock(jest)`) before using it.
- **`jest.mock("fs")` activates a fixed manual mock with surprising defaults.**
  - `existsSync(path)` returns `true` for non-empty paths.
  - `FakeStats.isFile()` returns `true` only for `.txt` files.
  - `access`, `writeFileSync`, etc. are silent no-ops.
  - Same applies to `fs-extra`, `isbinaryfile`, and `Session`.
- **Avoid raw `Object.defineProperty(vscode.X, ...)`**. Properties redefined this way persist across `it()` blocks and files within the same Jest worker: the single worst pattern in the test suite. Always use `MockedProperty` (which auto-restores via `Symbol.dispose`). When modifying legacy code that uses it, restore the original descriptor in `afterEach`. Never add new tests that mutate `vscode.window`, `vscode.workspace`, `vscode.commands`, etc. with bare `Object.defineProperty`.

## Test Types

- **Unit tests (Jest)**: Default. Use for `Actions`, tree nodes, FS providers, utils, etc.
- **End-to-end tests (WDIO + Cucumber)**: Use when behavior must be verified through the real VS Code UI against a real mainframe. **No mocks/stubs.**

## Unit tests (Jest + ts-jest)

### Layout & Naming
- `packages/<pkg>/__tests__/__unit__/`
- File naming: `<SourceFile>.unit.test.ts`.
- One top-level `describe` per source class/module; nested `describe`s per method or logical group.

### Run Tests
```bash
cd packages/zowe-explorer && pnpm exec jest <file-name-fragment>
```

### Mock Factories
Reuse helpers in `packages/zowe-explorer/__tests__/__mocks__/mockCreators/`:
- `shared.ts`: `createIProfile`, `createISession`, `createInstanceOfProfile`, `createValidIProfile`
- `datasets.ts`: `createDatasetSessionNode`, `createDatasetTree`, `createDatasetFavoritesNode`
- `uss.ts`: `createUSSSessionNode`, `createUSSTree`, `createUSSNode`
- `jobs.ts`: `createIJobObject`, `createJobSessionNode`
- `api.ts`: `createMvsApi`, `createUssApi`, `createJesApi`

If a fixture is missing, **add it to the matching file** instead of creating a one-off.

### `MockedProperty` over `Object.defineProperty`
When you need to stub a property that Jest can't easily mock (statics, getters, readonly fields), use the `MockedProperty` helper from `__mocks__/mockUtils.ts`. It restores the original value automatically.

```typescript
import { MockedProperty } from "../../__mocks__/mockUtils";

const profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
    value: { ssoLogin: jest.fn(), promptCredentials: jest.fn() } as any,
    configurable: true,
});
```

### Spying & Resetting
- Prefer `jest.spyOn(...)` over `jest.mock(...)` for single methods—it leaves the rest of the module intact.
- Reserve module-level `jest.mock("...")` for modules that must be fully replaced.
- Call `jest.restoreAllMocks()` in `beforeEach` to prevent spy leaks across tests.
- For one-off return values, prefer `mockReturnValueOnce` / `mockResolvedValueOnce`.

### Anti-patterns
- **No snapshot tests** for UI objects.
- **Avoid `any` casts**. Use API types.
- **No reaching into `src/` for private functions.**
- **No hardcoded sleeps** (`setTimeout`).
- **No raw `fs`/`path`**. Mock at the provider boundary.

## End-to-end tests (WDIO + Cucumber)
Located in `packages/zowe-explorer/__tests__/__e2e__/`.

### Layout & Naming
- `features/<area>/<Name>.feature` - Gherkin scenarios
- `step_definitions/<area>/<Name>.steps.ts` - Step implementations
- `__pageobjects__/` - Reusable page objects (e.g., `ProfileNode`, `QuickPick`). Add new page objects rather than ad-hoc selectors.
- `__common__/` - Shared WDIO config and helpers.

### Required environment
E2E tests require a valid Zowe team config and a `.env` file defining all `ZE_TEST_*` variables:

| Variable | Purpose |
| --- | --- |
| `ZE_TEST_PROFILE_NAME` | Profile name as it appears in the tree |
| `ZE_TEST_DS_FILTER` | Data set filter pattern |
| `ZE_TEST_DS_PATTERN` | Data set pattern used by table view tests |
| `ZE_TEST_PDS` | Existing PDS name |
| `ZE_TEST_PDS_MEMBER` | Existing PDS member name |
| `ZE_TEST_PS` | Existing sequential dataset name |
| `ZE_TEST_USS_FILTER` | USS filter path |
| `ZE_TEST_USS_DIR` | USS directory under the filter |
| `ZE_TEST_USS_FILE` | USS file under the directory |

Missing variables typically surface as cryptic step failures.

### Run
```bash
cd packages/zowe-explorer && pnpm test:e2e
```
E2E is **not** part of `pnpm test`. Only run it locally when configured.

### Authoring Conventions
- **No mocks, no stubs, ever.** If you need them, write a unit test instead.
- **Wait, don't sleep.** Use `browser.waitUntil(...)` or `waitForClickable()`.
- **Prefer page objects** for any selector you'd otherwise repeat.
- **Use `Examples:` (Scenario Outline)** to cover variants (Data Sets / USS / Jobs) without duplicating scenarios.
- **Keep steps reusable** across features.
- **Clean up after yourself.** Teardown steps should remove remote artifacts (datasets, jobs).

### Debugging a failing e2e
- Re-run single feature: `pnpm test:e2e -- --spec __tests__/__e2e__/features/<area>/<Name>.feature`
- Check `wdio` screenshots/logs (configured in `__common__/base.wdio.conf.ts`).
- Verify env vars for "element not found" failures.

## Pre-submit Checklist
- New/modified tests pass.
- Coverage maintained or improved.
- Lint (`pnpm lint`) and format (`pnpm pretty`) pass.