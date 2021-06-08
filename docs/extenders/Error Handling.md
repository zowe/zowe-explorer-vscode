# Error Handling Best Practices v1

This document describes error handling best practices for Zowe Explorer extenders.

## Contents

- [Objectives](#objectives)
- [Showing Errors to Users](#showing-errors-to-users)
- [Error Message Format](#error-message-format)
- [Additional Requirements](#additional-requirements)

## Objectives

Customers and developers need to see clear error messages when they use Zowe Explorer and its extenders.

By following this documentation, Zowe Explorer extenders will help users debug their extensions quickly and easily.

Zowe Explorer encourages extenders to use this guidance in order to:
- Help users understand which extension is causing an error, by including the name of the extension in the error message.
- Give developers more information in error logs.
- Standardize the error message format across all of Zowe Explorer's extenders.

## Showing Errors to Users

Extenders should use VSCode's API to show messages to users, so that the messages look like standard Zowe & VSCode message boxes.
- For showing information to the user: [vscode.window.showInformationMessage](https://code.visualstudio.com/api/references/vscode-api#window.showInformationMessage)
- For showing errors to the user: [vscode.window.showErrorMessage](https://code.visualstudio.com/api/references/vscode-api#window.showErrorMessage)

## Error Message Format

Error messages shown to the user should have the following format:

```
Extension Name Error - Error Message
```

Ex. for the Zowe Explorer FTP extension, the message would look like:

```
Zowe Explorer FTP Extension Error - Unable to delete node…
```

## Additional Requirements

- If your extender isn't implementing one of Zowe Explorer's APIs, it should throw a `not implemented` error for that API. [See an example of this from the FTP extension](https://github.com/zowe/vscode-extension-for-zowe/blob/8080ae14734eb9673b178687d92df94e203aad35/packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpMvsApi.ts#L200).
- Extenders should use [VSCode's localization module](https://github.com/Microsoft/vscode-nls#readme), to ensure that their extension can be translated into other languages.
