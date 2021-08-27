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

## Logging of Error Message

We highly recommend the usage of our API function when logging an extender's error messages.

This function logs messages in a standard format, which is used by Zowe Explorer and will be consistent across Zowe components.

Example:

```
// The logger must be initialized before calling the logging function
const zoweLogger = new IZoweLogger("Extender Name", "path/to/logging/location");

zoweLogger.logImperativeMessage("Test log message!", MessageSeverityEnum.TRACE);
```

## Showing Errors to Users

We highly recommend using our API function to show messages to users. This will provide a standard format
that is similar to Zowe Explorer and VSCode. It will also make sure the error is written to the log file.

Example:

```
// The logger must be initialized before calling the showVsCodeMessage function
const zoweLogger = new IZoweLogger("Extender Name", "path/to/logging/location");

ZoweVsCodeExtension.showVsCodeMessage("Test display message!", MessageSeverityEnum.TRACE, zoweLogger);
```

- If the extender isn't implementing one of Zowe Explorer's APIs, it is very important to throw a `not implemented` error for that API. [See an example of this from the FTP extension](https://github.com/zowe/vscode-extension-for-zowe/blob/8080ae14734eb9673b178687d92df94e203aad35/packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpMvsApi.ts#L200).

```
public allocateLikeDataSet(dataSetName: string, likeDataSetName: string):
    Promise<zowe.IZosFilesResponse> {
        throw new Error("Allocate like dataset is not supported in FTP extension.");
    }
```
