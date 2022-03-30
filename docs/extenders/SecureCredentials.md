# Managing Zowe Explorer credential security

Zowe Explorer extenders can adopt the Zowe Explorer Secure Credentials API to enable extensions to use Zowe profiles that are managed by the Secure Credential Store. The Secure Credentials API enables extenders to utilize the [Zowe security practices](https://docs.zowe.org/stable/user-guide/cli-scsplugin/) when performing z/OS actions outside of the core Zowe Explorer functions. The API is available in `@zowe/zowe-explorer-api` version 1.15.1 and higher.

You can access the Zowe Explorer Secure Credentials API, using the `KeytarApi()` class. The class lets you handle profiles that are managed by Secure Credential Store. Initialize the API before any extension is [registered with Zowe Explorer](../README-Extending.md#accessing-the-zowe-explorer-extender-api), so that extenders can access the Data Sets, USS, and Jobs views.

The following steps describe how to configure Zowe Explorer to use Zowe profiles that are managed by the Secure Credentials API.

**Follow these steps:**

1. Activate and initialize the Zowe Explorer API. Follow the steps in [Zowe Explorer extension dependencies and activation](../README-Extending.md#zowe-explorer-extension-dependencies-and-activation).

2. Define an NPM dependency to the Zowe Explorer API in your VS Code extension `package.json` file to get access to Typescript type definitions provided for the API.
3. Define an NPM dependency to Zowe CLI to get access to Typescript type definitions provided for Zowe Imperative.

   ```json
   "dependencies": {
       "@zowe/cli": "6.30.0",
       "@zowe/zowe-explorer-api": "1.16.0"
   }
   ```
