# Change Log

All notable changes to the "zowe-explorer-api" extension will be documented in this file.

## TBD Release

### Bug fixes

- Update dependencies for technical currency purposes.

## `1.22.5`

### New features and enhancements

- Replaced `keytar` dependency with `keyring` module from [`@zowe/secrets-for-zowe-sdk`](https://github.com/zowe/zowe-cli/tree/master/packages/secrets). [#2358](https://github.com/zowe/vscode-extension-for-zowe/issues/2358)

### Bug fixes

## `1.22.3`

- Updated dependencies for improved security.

## `1.22.2`

- Updated dependencies for improved security.

## Recent Changes

- Zowe Explorer extenders can now have their profile type's folder with meta file created in the /.zowe/profiles home directory upon initialization by calling the ZoweExplorerApiRegister.getExplorerExtenderApi().initForZowe(type: string, meta:imperative.ICommandProfileTypeConfiguration[]) during their activation with Zowe Explorer.

## `1.10.1`

- Initial release
