# Secure Credentials API Adoption

Extenders may have a need for z/OS actions to be taken outside of Zowe Explorer using Zowe profiles that are managed by the Secure Credentials Store. Zowe Explorer API has a way for extenders to handle this situation.

The `KeytarApi()` is available in `@zowe/zowe-explorer-api` version 1.15.1 and higher. Use of this API will need to be handled before the extension is registered with Zowe Explorer. This can be done by following the steps below:

1. Define a VS Code extension dependency as described in [Zowe Explorer extension dependencies and activation](../README-Extending.md#zowe-explorer-extension-dependencies-and-activation) to ensure that the Zowe Explorer API gets activated and initialized before your extension.
2. Define an NPM dependency to the Zowe Explorer API in your VS Code extension's `package.json` file to get access to Typescript type definitions provided for the API:

   ```json
   "dependencies": {
       "@zowe/cli": "6.30.0",
       "@zowe/zowe-explorer-api": "1.16.0"
   }
   ```

You will then be able to get access to initialized Zowe Explorer API objects provided by VS Code during or after activation. The following code snippet shows how to gain access:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const log = imperative.Logger.getAppLogger();
  const keytarApi = new KeytarApi(log);
  await keytarApi.activateKeytar(imperative.CredentialManagerFactory.initialized, EnvironmentManager.isTheia());
}
```

After the `KeytarApi()` has been initialized, [registration with Zowe Explorer](../README-Extending.md#accessing-the-zowe-explorer-api) can begin.
