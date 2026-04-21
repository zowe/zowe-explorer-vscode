# AGENTS.md

## Project overview

Zowe Explorer (ZE) is an extension for Visual Studio Code that offers access to z/OS mainframe resources.

## Architecture and logic patterns

Main packages: 
- [Zowe Explorer API](./packages/zowe-explorer-api): API and extensibility framework for Zowe Explorer.
- [Zowe Explorer VS Code Extension](./packages/zowe-explorer): Main VS Code extension providing tree views and user interface for interacting with z/OS systems.
- [Zowe Explorer FTP Extension](./packages/zowe-explorer-ftp-extension): Sample extension for Zowe Explorer that implements FTP (`zftp`) profile support.

### Guidelines:
- **Logic vs UI**: Use `Actions` classes (e.g., `MvsActions.ts`) to separate business logic from UI/Tree view providers.
- **UI Utilities**: Use the `Gui` utility (from `zowe-explorer-api`) for all user interactions like `showInputBox`, `showQuickPick`, and error/warning messages.
- **Logging**: Use `ZoweLogger` for important events, specifically in `error` and `warn` cases. Avoid logging for trivial or highly frequent operations.
- **API Usage**: Prefer using `zowe-explorer-api` to interact with mainframe resources instead of raw SDK calls where possible.

## Maintaining the monorepo

- **Dependencies**: The project is a monorepo. `zowe-explorer` depends on `zowe-explorer-api` using `workspace:*` references.
- **Build Order**: Changes in the API can sometimes require a full monorepo build (`pnpm build`) to be picked up by the VS Code extension.
- **Adding Packages**: Always use `pnpm` for dependency management. Before adding a new external package, check if it or a similar one already exists in the monorepo to minimize bundle size.
- **Circular Dependencies**: Run `pnpm madge` to ensure no circular dependencies are introduced between or within packages.

## Testing our code

- **Unit Tests**: Standardized with `jest` and `ts-jest`. Located in `__tests__` directories within each package.
- **E2E Tests**: Use `pnpm test:e2e` in `packages/zowe-explorer` to run WebDriver-automated tests in a VS Code window.
- **Integration Tests**: BDD-style tests using `wdio` and Cucumber in `packages/zowe-explorer`.
- **Mocks**: Use `jest-mock-vscode` for VS Code API mocking and follow established mock patterns.
- **Coverage**: Maintain or improve coverage when adding new logic. `pnpm test` generates coverage reports.

## Build and test commands

- `pnpm install` to install new dependencies
- `pnpm build` to build all packages sequentially (first API, then ZE webviews, then ZE, then FTP extension)
- `pnpm build:parallel` - useful for building all packages concurrently
- `pnpm madge` to run `madge` tool and detect circular dependencies
- `pnpm package` prepares all packages and ZE VSIX for distribution & testing
- `pnpm test` to run unit tests across all packages
- `cd packages/<package-name> && pnpm test` to run all unit tests specific to one package
- `cd packages/<package-name> && npx jest <test-file-name>` to run a single unit test file within a specific package
- `pnpm update-sdks` to update Zowe SDK versions in `package.json` files to latest available versions from NPM
- `pnpm fresh-clone` to wipe out `node_modules` - useful if switching between branches w/ multiple dependency changes or when isolating issues

The following pnpm scripts only exist in `packages/zowe-explorer`:
- `pnpm vscode:prepublish` ensures that all localized strings, `.nls.json` files, and `.l10n.json` files are up-to-date
- `pnpm test:e2e` to run end-to-end tests within a WebDriver-automated VS Code window.

## PR instructions

- Consider using Conventional Commits and isolating file changes by scope.
- Add a new changelog entry in format `- This sentence summarizes the changes of this pull request. [#Issue Number](https://github.com/zowe/zowe-explorer-vscode/issue/XXXX OR matching PR link)` in the appropriate changelog file.
- `pnpm lint`, `pnpm pretty`, and `pnpm build` must pass before PR is ready.
- Run `cd packages/zowe-explorer && pnpm vscode:prepublish` and commit any resultant changes.

## Safety & anti-patterns

- **Filesystem Access**: **NEVER** use direct `fs` or `path` calls for mainframe resources. Always use Zowe filesystem providers or `vscode.workspace.fs`.
- **Hardcoded Paths**: Do not use hardcoded temporary directories. Use `extensionContext.storageUri` or `globalStorageUri`.
- **Error Handling**: Use `try-catch` with proper async/await. Use `AuthUtils.errorHandling` where appropriate, but avoid monolithic handlers when more specific logic is needed.
- **Security**:
  - Never log user credentials or passwords to the console.
  - Never read `config.yaml` or user's Zowe config for more context (`**/zowe.config.json`).
  - Always sanitize user inputs before passing to shell commands.
