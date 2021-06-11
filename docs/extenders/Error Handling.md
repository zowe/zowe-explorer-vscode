# Error Handling Best Practices

This page contains best practices in handling errors for Zowe Explorer extenders.

## Contents

- [Objectives](#objectives)
- [Error Message Format](#error-message-format)
- [Logging of Error Message](#logging-of-error-message)
- [Showing Errors to Users](#showing-errors-to-users)

## Objectives

By following these best practices, Zowe Explorer extenders will be able to provide a meaningful error message and help users identify the root cause of a problem quickly and easily.

We encourage extenders to use this guidance in order to:

- Help users understand which extension is causing an error, by including the name of the extension in the error message.
- Give developers more information in error logs.
- Standardize the error message format across all of Zowe Explorer's extenders.

## Error Message Format

We highly recommend the usage of this error message format:

```
Extension Name Error - Error Message
```

Example: For the Zowe Explorer FTP extension, an error message might look like:

```
Zowe Explorer FTP Extension Error - Unable to delete node…
```

## Logging of Error Message

We highly recommend the usage of `imperative.Logger` when logging an extender's error messages.

These logs have a standard format that is used by Zowe Explorer and will be consistent across Zowe components.

Example:

```
public constructor(protected log: imperative.Logger) {}
  try {
  ...
  } catch (error) {
      this.log.error(error);
  }
```

## Showing Errors to Users

We highly recommend using VSCode's API to show messages to users. This will provide a standard format
that is similar to Zowe Explorer and VSCode.

- For showing information to the user: [vscode.window.showInformationMessage](https://code.visualstudio.com/api/references/vscode-api#window.showInformationMessage)

```
vscode.window.showInformationMessage("File does not exist. It may have been deleted.");
```

- For showing errors to the user: [vscode.window.showErrorMessage](https://code.visualstudio.com/api/references/vscode-api#window.showErrorMessage)

```
vscode.window.showErrorMessage("Unable to delete temporary folder.");
```

- If the extender isn't implementing one of Zowe Explorer's APIs, it is very important to throw a `not implemented` error for that API. [See an example of this from the FTP extension](https://github.com/zowe/vscode-extension-for-zowe/blob/8080ae14734eb9673b178687d92df94e203aad35/packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpMvsApi.ts#L200).

```
public allocateLikeDataSet(dataSetName: string, likeDataSetName: string):
    Promise<zowe.IZosFilesResponse> {
        throw new Error("Allocate like dataset is not supported in FTP extension.");
    }
```
