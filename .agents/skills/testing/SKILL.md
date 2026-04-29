---
name: testing
description: Write and maintain Jest unit tests and WDIO/Cucumber end-to-end tests in the Zowe Explorer monorepo. Use when adding, updating, debugging, or reviewing tests, when working with `*.unit.test.ts` files, `__tests__/__unit__/` or `__tests__/__e2e__/` directories, `.feature` files, step definitions, page objects, mock factories (`mockCreators/`), `MockedProperty`, `jest-mock-vscode`, `jest.config`, `wdio.conf`, or running `pnpm test` / `pnpm test:e2e` in `packages/zowe-explorer/`, `packages/zowe-explorer-api/`, or `packages/zowe-explorer-ftp-extension/`.
metadata:
  version: "1.0"
---

# Zowe Explorer Testing

Guidance for writing and maintaining tests in the Zowe Explorer monorepo. The agent should already understand general testing best practices (Arrange/Act/Assert, isolation, deterministic assertions); this skill focuses on Zowe-Explorer-specific conventions, helpers, and gotchas.

## Gotchas

Read these before writing or modifying tests - they describe environment-specific behavior that defies reasonable assumptions.

- **The `vscode` mock is mostly hand-rolled, not `jest-mock-vscode` wholesale.** `__tests__/__mocks__/vscode.ts` defines `MarkdownString`, `ProgressLocation`, `Uri`, `Range`, `WorkspaceEdit`, the `env` namespace, and most other types by hand. Only a small subset (`FileSystemError`, `Selection`, `Position`, `ThemeIcon`, `CodeLensProvider`) is destructured from `require("jest-mock-vscode").createVSCodeMock(jest)`. If a test needs a VS Code class/value that isn't already exported, importing it from `"vscode"` will return `undefined` - extend `__mocks__/vscode.ts` (either by adding a manual definition or pulling more from `createVSCodeMock(jest)`) before using it.
- **`jest.mock("fs")` activates a fixed manual mock with surprising defaults.** Tests opt into `__tests__/__mocks__/fs.ts` by adding `jest.mock("fs");` at the top of the file. That mock has gotchas:
  - `existsSync(path)` returns `true` for any non-empty path, so "file should not exist" assertions must override the spy.
  - `FakeStats.isFile()` returns `true` only for paths ending in `.txt`; everything else is treated as a directory.
  - `access`, `appendFileSync`, `closeSync`, `unlinkSync`, `writeFileSync`, `writeSync` are silent no-ops. Re-spy if you need to assert calls.
  - The same applies to `__mocks__/fs-extra.ts`, `__mocks__/isbinaryfile.ts`, and `__mocks__/Session.ts`. Manual mocks for *node* modules require an explicit `jest.mock("<name>")` to activate; without it the real module loads and may hit real disk.
- **Avoid raw `Object.defineProperty(vscode.X, ...)`: it leaks across tests.** This is the single worst pattern in the existing suite - properties redefined this way persist on the shared `vscode` mock module across `it()` blocks (and across files within the same Jest worker). Always use `MockedProperty` (which auto-restores via `Symbol.dispose`). Or, when modifying legacy code that still uses `Object.defineProperty`, restore the original descriptor in `afterEach`. Never add new tests that mutate `vscode.window`, `vscode.workspace`, `vscode.commands`, etc. with bare `Object.defineProperty`.

## When to use which test type

Pick the lightest layer that exercises the behavior you care about.

- **Unit tests (Jest)** - default for almost everything. Use for `Actions` classes, tree nodes, FS providers, utils, and any code where the VS Code API surface or Zowe SDK can be reasonably mocked.
- **End-to-end tests (WDIO + Cucumber)** - use when behavior must be verified through the real VS Code UI against a real mainframe (tree expansion, command palette flows, editor save/conflict, dialogs, user actions). E2E tests **cannot** and **must not** mock or stub anything; they require a real Zowe team config and a live system.

If you find yourself wanting to mock or stub something inside an e2e test, that's a signal to write a unit test instead.

## Unit tests (Jest + ts-jest)

### Layout & naming

- Tests live in `packages/<pkg>/__tests__/__unit__/` mirroring the `src/` directory structure.
- File naming: `<SourceFile>.unit.test.ts`. Variants like `<SourceFile>.extended.unit.test.ts` are acceptable when splitting a large suite by feature area (see `DatasetActions.extended.unit.test.ts`).
- One top-level `describe` per source class/module; nested `describe`s per method or logical group.

### Run a single test for fast feedback

```bash
cd packages/zowe-explorer && npx jest <file-name-fragment>
# e.g. npx jest AuthUtils.unit.test
```

Run the package suite with `pnpm test` (generates coverage). Run tests for the full monorepo with `pnpm test` from the repo root.

### Mocking VS Code

- The package `__mocks__/vscode.ts` provides the VS Code mock: mostly hand-rolled, with a few classes pulled from `jest-mock-vscode`'s `createVSCodeMock(jest)`. See the gotcha above for details.
- Import VS Code types/values from `vscode` as usual; the mock layer intercepts at runtime.
- If something you need is missing from `__mocks__/vscode.ts`, add it (manual definition or extra destructured value from `createVSCodeMock(jest)`) rather than redefining it inline in your test.

### Mock factories - prefer over hand-rolled fixtures

Reuse the factory helpers in `packages/zowe-explorer/__tests__/__mocks__/mockCreators/` instead of constructing profiles, sessions, or nodes inline:

- `shared.ts` - `createIProfile`, `createISession`, `createInstanceOfProfile`, `createValidIProfile`, …
- `datasets.ts` - `createDatasetSessionNode`, `createDatasetTree`, `createDatasetFavoritesNode`, …
- `uss.ts` - `createUSSSessionNode`, `createUSSTree`, `createUSSNode`, …
- `jobs.ts` - `createIJobObject`, `createJobSessionNode`, …
- `api.ts` - `createMvsApi`, `createUssApi`, `createJesApi`, …

```typescript
import { createIProfile, createISession } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode } from "../../__mocks__/mockCreators/datasets";

const profile = createIProfile();
const session = createISession();
const sessionNode = createDatasetSessionNode(session, profile);
```

If a needed fixture doesn't exist, **add it to the matching `mockCreators/` file** rather than creating a one-off in the test.

### `MockedProperty` over `Object.defineProperty`

When you need to stub a property that Jest can't easily mock (statics, getters, readonly fields), use the `MockedProperty` helper from `__mocks__/mockUtils.ts`. It uses TS 5.2 explicit resource management to restore the original value automatically and is safer than raw `Object.defineProperty`.

```typescript
import { MockedProperty } from "../../__mocks__/mockUtils";

const profilesCacheMock = new MockedProperty(Constants, "PROFILES_CACHE", {
    value: { ssoLogin: jest.fn(), promptCredentials: jest.fn() } as any,
    configurable: true,
});
```

### Spying & resetting

- Prefer `jest.spyOn(...)` over `jest.mock(...)` when you only need to override one method - it leaves the rest of the module intact and is easier to restore.
- Reserve module-level `jest.mock("...")` for modules that must be fully replaced (e.g. `jest.mock("../../../src/tools/ZoweLocalStorage")` to avoid touching real persistence).
- Call `jest.restoreAllMocks()` in `beforeEach` (or the suite's setup) so spies don't leak across tests:

```typescript
describe("AuthUtils", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        // ...per-test arrangement
    });
});
```

- For one-off return values, prefer `mockReturnValueOnce` / `mockResolvedValueOnce` so the spy auto-clears after the call you're testing.

### Error-handling tests

Behavior tested in unit tests should match the project's error patterns:

- Verify that `Actions` paths route errors through `AuthUtils.errorHandling` with the correct `apiType`, `profile`, and `scenario`.
- Verify that user-facing failures use `Gui.*` (not `vscode.window.*` directly).
- Verify `ZoweLogger` calls only at `error`/`warn` for meaningful events; don't assert on noisy `trace`/`debug` logs.

### Anti-patterns to avoid

- **No snapshot tests** for `TreeItem` / VS Code UI objects - they're brittle across refactors and hide intent. Assert on the specific properties you care about instead.
- **Avoid `any` casts** to bypass types in tests; use the API types from `@zowe/zowe-explorer-api` or extend the mock factories.
- **No reaching into `src/` for private classes or functions.** If you need to test something private, that's usually a signal to extract a helper or expand the public surface deliberately.
- **No hardcoded sleeps** (`await new Promise(r => setTimeout(r, ...))`); use fake timers or await the promise the code under test exposes.
- **No raw `fs`/`path` unless necessary** - even in tests, use the same FS abstractions the production code uses; mock at the provider boundary.

### Coverage

- Maintain or improve coverage when adding logic. `pnpm test` writes a coverage report for unit tests under `packages/<pkg>/results/unit`.
- New `Actions` methods, FS provider operations, and error-handling branches should each have at least one positive and one negative test.

## End-to-end tests (WDIO + Cucumber)

Located in `packages/zowe-explorer/__tests__/__e2e__/`.

### Layout & naming

- `features/<area>/<Name>.feature` - Gherkin scenarios, grouped by area (`list`, `edit`, `dialogs`, `views`).
- `step_definitions/<area>/<Name>.steps.ts` - step implementations matching the feature, one file per `.feature` (mirror the name).
- `step_definitions/utils/` - shared helpers used across multiple step files.
- `__pageobjects__/` - reusable page objects (e.g. `ProfileNode`, `QuickPick`, `DatasetTableViewPage`). **Add new page objects** rather than ad-hoc selectors in step files.
- `__common__/` - shared WDIO config (`base.wdio.conf.ts`, `shared.wdio.ts`) and helpers like `paneDivForTree`.

### Required environment

E2E tests require:

1. A valid Zowe team config with z/OSMF, TSO, and SSH profiles, secure credentials, and a valid TSO account number / SSH port. See `packages/zowe-explorer/__tests__/__e2e__/README.md` for the full list.
2. A `.env` file in `__tests__/__e2e__/` defining all `ZE_TEST_*` variables consumed by step definitions, including:

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

Missing variables typically surface as cryptic step failures - fail fast by reading them into a `testInfo` object at the top of the step file (existing pattern in `ListTreeItems.steps.ts`).

### Run

```bash
cd packages/zowe-explorer && pnpm test:e2e
```

E2E is **not** part of `pnpm test`; only run it locally when you have a configured environment.

### Authoring conventions

- **No mocks, no stubs, ever.** If you need them, write a unit test instead. Don't bypass the rule by patching imports inside step files.
- **Wait, don't sleep.** Use `browser.waitUntil(...)`, `await element.waitForClickable()`, or page-object `wait()` helpers. Hardcoded `setTimeout` waits make the suite flaky.
- **Prefer page objects** for any selector you'd otherwise repeat. Selectors live next to the page object class, never inline in step definitions.
- **Use `Examples:` (Scenario Outline)** to cover Data Sets / USS / Jobs variants of the same flow rather than duplicating scenarios - see `ListTreeItems.feature` for the pattern.
- **Keep steps reusable.** Phrase `Given/When/Then` lines so they can be shared (`shared.steps.ts`) across features.
- **Clean up after yourself.** If a scenario creates remote artifacts (dataset, USS file, job), make sure a teardown step removes them so subsequent runs are deterministic.

### Debugging a failing e2e

- Re-run a single feature: `cd packages/zowe-explorer && pnpm test:e2e -- --spec __tests__/__e2e__/features/<area>/<Name>.feature`.
- Check `wdio` screenshots/logs (path configured in `__common__/base.wdio.conf.ts`).
- Verify env vars: most "element not found" failures trace back to a missing or stale `ZE_TEST_*` value.

## Pre-submit checklist for test changes

- [ ] New/modified unit tests pass: `cd packages/<pkg> && npx jest <file>`
- [ ] Full package suite passes: `cd packages/<pkg> && pnpm test`
- [ ] Coverage did not drop for touched files (check the coverage report)
- [ ] Avoid new `any` types, no snapshot tests on `TreeItem`s, no hand-rolled fixtures that duplicate `mockCreators/` factories
- [ ] If you touched e2e: `pnpm test:e2e` runs cleanly against your configured environment
- [ ] `pnpm lint` and `pnpm pretty` are clean
