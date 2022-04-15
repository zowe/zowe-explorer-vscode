# Change Log

All notable changes to the "zowe-explorer-api" extension will be documented in this file.

## 2.0.0-next.202204081040

- Added documentation on promptCredentials(). [1728](https://github.com/zowe/vscode-extension-for-zowe/pull/1728)
- Updated ProfilesCache.refresh() to handle the merging on v1 and v2 profiles. [1729](https://github.com/zowe/vscode-extension-for-zowe/pull/1729)

## `2.0.0-next.202204041200`

- Added new API to expose `promptCredentials` for extender use. [#1699](https://github.com/zowe/vscode-extension-for-zowe/pull/1699)

## `1.17.0`

- Zowe Explorer extenders can now have their profile type's folder with meta file created in the /.zowe/profiles home directory upon initialization by calling the ZoweExplorerApiRegister.getExplorerExtenderApi().initForZowe(type: string, meta:imperative.ICommandProfileTypeConfiguration[]) during their activation with Zowe Explorer.

## `1.10.1`

- Initial release
