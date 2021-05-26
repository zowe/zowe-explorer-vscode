# Error Handling Best Practices v1

This document describes how extenders using the Zowe Explorer API should report errors which occur in their extensions.

TODO: The recommendations from this document will be solidified into an API in V2.

## Contents

- [Objectives](#objectives)
- [Error Message Format](#error-message-format)
- [Logging of Errors](#logging-of-errors)

## Objectives

The practices described here are intended to do the following:

- Standardize the number & appearance of errors across Zowe Explorer and extenders using its API.
- Help users understand the source of errors they encounter, by including the name of the extender in the error message.
- Increase information available to developers in error logs.

## Error Message Format

Any error message should have the following format:

```
Extension Name Error - Error Message
```

Ex. for the Zowe Explorer FTP extension, the message would look like:

```
Zowe Explorer FTP Extension Error - Unable to delete node…
```

## Logging of Errors

- Every error should be logged to the VSCode console. _TODO: Extenders need access to the Imperative logger!_
- Extenders should throw a `not implemented` error for any Zowe Explorer APIs they aren’t implementing. [See an example of this from the FTP extension](https://github.com/zowe/vscode-extension-for-zowe/blob/8080ae14734eb9673b178687d92df94e203aad35/packages/zowe-explorer-ftp-extension/src/ZoweExplorerFtpMvsApi.ts#L200).
