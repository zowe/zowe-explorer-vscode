# Zowe Explorer Integration Testing

Zowe Explorer has two types of integration tests:

- CucumberJS behavior-driven tests, where stubbing is not supported
- Mocha tests, where stubbing or mocking is required to test a scenario

## CucumberJS behavior-driven tests

These tests use the fake integration profiles provided in the `__tests__/__integration__/ci` folder. No additional configuration is necessary as the tests will use this directory as the Zowe home folder.

**Note:** The credentials provided with each service profile will still be sent to the APIs during the UI-oriented tests, as stubbing is not possible with tests that leverage both Cucumber and WebdriverIO. Tests that do not require a user interface should be implemented as a Mocha test (see [Mocha tests](#mocha-tests) below for more info).

Run the tests by executing the `pnpm test:integration` command.

## Mocha tests

When running the Mocha tests, your Zowe config can remain intact as it will depend on the stubs in each test to get profile info.
To run the tests, open the **"Run & Debug"** panel and click on the dropdown at the top of the pane. Select "TDD Integration Tests (Mocha)" in the dropdown and then click the **"Play"** ▶️ button beside the dropdown to start the test process.

When creating tests that use Mocha and vscode-test, functions can be stubbed using the `sinon` package. For example:

```ts
import * as sinon from "sinon";
import { Profiles } from "../../../src/configuration/Profiles";

// Simple stub to show how it can be used to throw an error
const getInstanceStub = sinon.stub(Profiles, "getInstance");
getInstanceStub.throws("Failed to retrieve Profiles");
```
