# Secure Credentials API Adoption

Extenders may have a need for z/OS actions to be taken outside of Zowe Explorer using Zowe profiles that are managed by the Secure Credentials Store. Zowe Explorer API has a way for extenders to handle that situation.

The use of the KeytarApi() will need to be handled before the extension is registered with Zowe Explorer by following these steps.

1. define a VS Code extension dependency as [described here](../README-Extending.md#zowe-explorer-extension-dependencies-and-activation) to ensure Zowe Explorer API gets activated and initialized before your extension and
2. define an NPM dependency to the Zowe Explorer API in your VS Code extension's package.json file to get access to Typescript type definitions provided for the API:

```json
"dependencies": {
    "@zowe/cli": "6.30.0",
    "@zowe/zowe-explorer-api": "1.16.0"
}
```

Then you will be able to get access to initialized Zowe Explorer API objects provided by VS Code during or after activation. The following code snippet shows how to gain access:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const log = imperative.Logger.getAppLogger();
  const keytarApi = new KeytarApi(log);
  await keytarApi.activateKeytar(imperative.CredentialManagerFactory.initialized, EnvironmentManager.isTheia());
}
```

After the KeytarApi() has been initialized, [registration with Zowe Explorer](../README-Extending.md#accessing-the-zowe-explorer-api) can begin.
