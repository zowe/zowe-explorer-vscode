# Secure Credentials API Adoption

Zowe Explorer extenders can adopt the Zowe Explorer Secure Credentials API to enable extensions to use Zowe profiles that are managed by the Secure Credential Store. The Secure Credentials API enables extenders to utilize the [Zowe security practices](https://docs.zowe.org/stable/user-guide/cli-scsplugin/) when performing z/OS actions outside of the core Zowe Explorer functions. The API is available in `@zowe/zowe-explorer-api` version 1.15.1 and higher.

You can access the Zowe Explorer Secure Credentials API, using the `KeytarApi()` class, which handles profiles that are managed by the Secure Credential Store. Initialize the API before any extension is [registered with Zowe Explorer](../README-Extending.md#accessing-the-zowe-explorer-extender-api), so that extenders can access the Data Sets, USS, and Jobs views.

## Prerequisites

Meet the following prerequisites:

- Ensure that the Zowe Explorer API is activated and initialized before you can use an extension. Define a VS Code extension dependency. For more information, see [Zowe Explorer extension dependencies and activation](../README-Extending.md#zowe-explorer-extension-dependencies-and-activation).
- Get access to the initialized Zowe Explorer API objects that are provided by VS Code during or after activation. Use the following code snippet to gain access to `KeytarApi()`:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const log = imperative.Logger.getAppLogger();
  const keytarApi = new KeytarApi(log);
  await keytarApi.activateKeytar(imperative.CredentialManagerFactory.initialized, EnvironmentManager.isTheia());
}
```

## Initialize `KeytarApi()`

Follow these steps to initialize `KeytarApi()`:

1. Define an NPM dependency to the Zowe Explorer API in your VS Code extension `package.json` file to get access to Typescript type definitions provided for the API.
2. Define an NPM dependency to Zowe CLI to get access to Typescript type definitions provided for Zowe Imperative.

   ```json
   "dependencies": {
       "@zowe/cli": "6.30.0",
       "@zowe/zowe-explorer-api": "1.16.0"
   }
   ```
