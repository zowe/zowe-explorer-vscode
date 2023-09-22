# USS Profile Sample

Demonstrates adding support for a new profile type to the USS tree in Zowe Explorer.

This samples adds SSH profiles to the Zowe Explorer USS tree, so that files can be managed on a mainframe or any Unix server that supports SFTP (FTP over SSH).

In "extension.ts" the Zowe Explorer API is used to load SSH profiles, and [`SshUssApi`](/samples/uss-profile-sample/src/SshUssApi.ts) is registered to enable USS file operations such as listing, downloading, and uploading.

**Warning:** This extension performs remote file operations and has not been thoroughly tested. Use at your own risk for testing purposes only.

## Running the sample

- Open this sample in VS Code
- `yarn`
- `yarn run compile`
- `F5` to start debugging
