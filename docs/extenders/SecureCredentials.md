# Secure Credentials API Adoption

As a Zowe Explorer extender, there may be a need for z/OS actions to be taken outside of Zowe Explorer space using a Zowe profile that is managed by the Secure Credentials Store. Zowe Explorer API has a way to handle this situation making it easier for the Zowe Explorer extender.

The Zowe Explorer API to handle profiles managed by the Secure Credential Store is `KeytarApi()`. This API is available in `@zowe/zowe-explorer-api` version 1.15.1 and higher. Use of this API will need to be handled before the extension is [registered with Zowe Explorer(../README-Extending.md#accessing-the-zowe-explorer-api) to access the Data Sets, USS, and Jobs views.

Initializing the `KeytarApi()` can be done by following the steps below:

1. Define a VS Code extension dependency as described in [Zowe Explorer extension dependencies and activation](../README-Extending.md#zowe-explorer-extension-dependencies-and-activation) to ensure that the Zowe Explorer API gets activated and initialized before your extension.
2. Define an NPM dependency to the Zowe Explorer API in your VS Code extension's `package.json` file to get access to Typescript type definitions provided for the API:

   ```json
   "dependencies": {
       "@zowe/cli": "6.30.0",
       "@zowe/zowe-explorer-api": "1.16.0"
   }
   ```

You will then be able to get access to the initialized Zowe Explorer API objects provided by VS Code during or after activation. The following code snippet shows how to gain access to `KeytarApi()`:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const log = imperative.Logger.getAppLogger();
  const keytarApi = new KeytarApi(log);
  await keytarApi.activateKeytar(imperative.CredentialManagerFactory.initialized, EnvironmentManager.isTheia());
}
```
