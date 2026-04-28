# AGENTS.md

You are an expert software engineer and VS Code extension developer working on Zowe Explorer.

## Available Agent Skills

This repository includes custom agent skills located in `.agents/skills/` to help with specific workflows. You can invoke them by mentioning their name or asking to perform the related task.

- **`breaking-changes`**: Audit pull requests for breaking changes (API and behavioral) in the monorepo.
- **`code-quality`**: Refactor, deduplicate, and improve TypeScript code quality using Zowe Explorer specific patterns.
- **`regression-check`**: Review code changes for functional correctness and regressions before merging or release.
- **`review-prs`**: Review pull requests for code quality, security, and Zowe V3 conformance.
- **`zedc`**: Use the Zowe Explorer Development CLI for sandboxed testing and environment setup (only when explicitly requested).

## Commands you can use

- **Install:** `pnpm install` (always use pnpm)
- **Build:** `pnpm build` (builds sequentially: API -> webviews -> ZE -> FTP extension)
- **Build Parallel:** `pnpm build:parallel`
- **Test (All):** `pnpm test`
- **Test (Package):** `cd packages/<package-name> && pnpm test`
- **Test (Single File):** `cd packages/<package-name> && npx jest <test-file-name>`
- **E2E Tests:** `cd packages/zowe-explorer && pnpm test:e2e` (runs WebDriver-automated tests in VS Code)
- **Lint & Format:** `pnpm lint` and `pnpm pretty`
- **Check Dependencies:** `pnpm madge` (detects circular dependencies)
- **Clean:** `pnpm fresh-clone` (wipes `node_modules` - useful when switching branches)
- **Update SDKs:** `pnpm update-sdks` (updates Zowe SDK versions to latest from NPM)
- **Package:** `pnpm package` (prepares all packages and ZE VSIX for distribution & testing)
- **Prepublish:** `cd packages/zowe-explorer && pnpm vscode:prepublish` (updates localized strings)

## Project overview

Zowe Explorer (ZE) is an extension for Visual Studio Code that offers access to z/OS mainframe resources.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js, Webpack, Jest, pnpm.

## Project structure

The project is a monorepo managed by pnpm. `zowe-explorer` depends on `zowe-explorer-api` using `workspace:*` references.

- `packages/zowe-explorer-api/`: API and extensibility framework.
- `packages/zowe-explorer/`: Main VS Code extension (tree views, UI).
- `packages/zowe-explorer-ftp-extension/`: Sample extension implementing FTP (`zftp`) profile support.

*Note: Changes in the API can sometimes require a full monorepo build (`pnpm build`) to be picked up by the VS Code extension.*

## Architecture and logic patterns

- **Logic vs UI**: Use `Actions` classes (e.g., `MvsActions.ts`) to separate business logic from UI/Tree view providers.
- **UI Utilities**: Use the `Gui` utility (from `zowe-explorer-api`) for all user interactions like `showInputBox`, `showQuickPick`, and error/warning messages.
- **Logging**: Use `ZoweLogger` for important events, specifically in `error` and `warn` cases. Avoid logging for trivial or highly frequent operations.
- **API Usage**: Prefer using `zowe-explorer-api` to interact with mainframe resources instead of raw SDK calls where possible.

## Code style examples

**Error Handling:**
```typescript
// ✅ Good - Uses AuthUtils.errorHandling for consistent user feedback
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

**Logging:**
```typescript
// ✅ Good - Logs with context before handling
ZoweLogger.error(`Operation failed for ${profile}: ${error.message}`);
```

## Testing practices

- **Unit Tests**: Standardized with `jest` and `ts-jest`. Located in `__tests__` directories within each package.
- **Integration Tests**: BDD-style tests using `wdio` and Cucumber in `packages/zowe-explorer`.
- **Mocks**: Use `jest-mock-vscode` for VS Code API mocking and follow established mock patterns.
- **Coverage**: Maintain or improve coverage when adding new logic. `pnpm test` generates coverage reports.

## Boundaries

- ✅ **Always do:** 
  - Use `vscode.workspace.fs` or Zowe filesystem providers for file access.
  - Use `extensionContext.storageUri` or `globalStorageUri` for temporary files.
  - Sanitize user inputs before passing to shell commands.
  - Run `pnpm lint`, `pnpm pretty`, and `pnpm build` before submitting PRs.
- ⚠️ **Ask first:** 
  - Before adding new external dependencies (check if they exist in the monorepo first to minimize bundle size).
  - Before making changes that might break backward compatibility in `zowe-explorer-api`.
- 🚫 **Never do:** 
  - **NEVER** use direct `fs` or `path` calls for mainframe resources.
  - **NEVER** use hardcoded temporary directories.
  - **NEVER** log user credentials or passwords to the console.
  - **NEVER** read `config.yaml` or user's Zowe config for more context (`**/zowe.config.json`).

## PR instructions

- Consider using Conventional Commits and isolating file changes by scope.
- Add a new changelog entry in format `- This sentence summarizes the changes of this pull request. [#Issue Number](https://github.com/zowe/zowe-explorer-vscode/issue/XXXX OR matching PR link)` in the appropriate changelog file.
- `pnpm lint`, `pnpm pretty`, and `pnpm build` must pass before PR is ready.
- Run `cd packages/zowe-explorer && pnpm vscode:prepublish` and commit any resultant changes.
