# AGENTS.md

## Project overview

Zowe Explorer (ZE) is an extension for Visual Studio Code that offers access to z/OS mainframe resources.

## Architecture

Main packages: 
- [Zowe Explorer API](./packages/zowe-explorer-api): API and extensibility framework for Zowe Explorer.
- [Zowe Explorer VS Code Extension](./packages/zowe-explorer): Main VS Code extension providing tree views and user interface for interacting with z/OS systems.
- [Zowe Explorer FTP Extension](./packages/zowe-explorer-ftp-extension): Sample extension for Zowe Explorer that implements FTP (`zftp`) profile support.

## PR instructions

- Consider using Conventional Commits and isolating file changes by scope.
- Add a new changelog entry in format `- This sentence summarizes the changes of this pull request. [#Issue Number](https://github.com/zowe/zowe-explorer-vscode/issue/XXXX OR matching PR link)` in the appropriate changelog file.
- `pnpm lint`, `pnpm pretty`, and `pnpm build` must pass before PR is ready.

## Security considerations

- Never log user credentials or passwords to the console.
- Never read `config.yaml` or user's Zowe config for more context (`**/zowe.config.json`).
- Always sanitize user inputs before passing to shell commands.