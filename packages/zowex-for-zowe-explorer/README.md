# Zowe Remote SSH for Zowe Explorer

The Zowe Remote SSH API for Zowe Explorer offers several features, enabling developers to interact with mainframe resources over SSH directly from their IDE.

## Features

- **Dataset Operations**: Create, read, write, and delete datasets
- **USS File Access**: Create, read, write, and delete files and directories in Unix System Services
- **Job Management**: Submit, view, cancel, hold, and release jobs on z/OS

## Usage

To deploy an instance of the Zowe Remote SSH server, run the `Zowe Explorer: Connect to zowex server on host...` command from the command palette. Select an SSH profile from the list of profiles to start the deployment and connection process. Once complete, the SSH profile is added to the Zowe Explorer tree views.

In the event that the server is unresponsive, you can restart the server with the `Zowe Explorer: Restart zowex server on host...` command.

To remove the server instance entirely, run the `Zowe Explorer: Uninstall zowex server on host...` command.

## Development

### Linking Zowex SDK from source

**From a local branch**

To test local changes to `@zowe/zowex-for-zowe-sdk`, link your local `zowex` repository from the root of the Zowe Explorer workspace:

```bash
# Uses default path: ../zowex/packages/sdk
pnpm --filter zowex-for-zowe-explorer link:zowex

# Or specify a custom path (must be relative to workspace root)
pnpm --filter zowex-for-zowe-explorer link:zowex ../custom-path/packages/sdk
```

**Note:** Any code changes made to existing files in your local SDK repository are immediately available in Zowe Explorer because the package is linked. After adding or removing files in the SDK, you must re-run `pnpm install` in the Zowe Explorer workspace to ensure the new file structure is recognized.

**From a pull request**

To test changes to a Zowex PR, specify a PR number from the `zowex` repository on the `link:zowex` command:

```bash
# Installs SDK from CI build of Zowex PR #1337
pnpm --filter zowex-for-zowe-explorer link:zowex 1337
```

This downloads the `zowex-sdk` artifact from the latest successful run of the `build` workflow for the specified PR, and installs the `zowex` SDK from the TGZ contained in the artifact.

### Testing backend changes

To test changes to the `zowex` server without redeploying, define a `serverPath` property in your SSH profile in `zowe.config.json`. Point it to the directory containing the built `zowex` binary on the host (for example, `<deployDir>/c/build-out`).

```json
"profiles": {
  "ssh_dev": {
    "type": "ssh",
    "properties": {
      "serverPath": "~/zowex/c/build-out"
    }
  }
}
```
