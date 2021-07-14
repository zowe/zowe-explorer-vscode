# Secure Credentials API Adoption

Zowe Explorer extenders can adopt Zowe Explorer's Secure Credentials API to enable their extension to use Zowe profiles managed by the Secure Credential Store. This API makes it easy for extenders to utilize [Zowe's security practices](https://docs.zowe.org/stable/user-guide/cli-scsplugin/) when performing z/OS actions outside of core Zowe Explorer functions. It is available in `@zowe/zowe-explorer-api` version 1.15.1 and higher.

Zowe Explorer's Secure Credentials API can be accessed via the `KeytarApi()` class, which handles profiles managed by the Secure Credential Store. Extenders will need to initialize this API before their extension is [registered with Zowe Explorer](../README-Extending.md#accessing-the-zowe-explorer-api) to access the Data Sets, USS, and Jobs views.

You can initialize the `KeytarApi()` by following the steps below:

1. Define a VS Code extension dependency as described in [Zowe Explorer extension dependencies and activation](../README-Extending.md#zowe-explorer-extension-dependencies-and-activation) to ensure that the Zowe Explorer API gets activated and initialized before your extension.
2. Define an NPM dependency to the Zowe Explorer API in your VS Code extension's `package.json` file to get access to Typescript type definitions provided for the API. Also define an NPM dependency to Zowe CLI to get access to Typescript type definitions provided for Zowe Imperative.

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
