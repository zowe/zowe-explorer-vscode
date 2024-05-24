# Zowe Explorer Integration Testing

Zowe Explorer has two types of integration tests:

- CucumberJS behavior-driven tests, where stubbing is not supported
- Mocha tests, where stubbing or mocking is required to test a scenario

## CucumberJS behavior-driven tests

To run the CucumberJS features, you will need **at least 3** service profiles in your Zowe config.
These profiles need a valid hostname in order to pass profile validation, specifically to execute tests for commands such as "Issue TSO Command."
However, they do not require valid credentials, so fake credentials can be used.

**Note:** The credentials provided with each service profile will still be sent to the APIs during the UI-oriented tests, as stubbing is not possible with tests written with Cucumber/Gherkin.
Tests that do not require the UI should be implemented using the Mocha-based testing.

After preparing your Zowe config to meet the above requirements, run the tests by executing the `pnpm test:integration-bd` command.

## Mocha tests

When running the Mocha tests, your Zowe config can remain intact as it will depend on the stubs in each test to get profile info.
To run the tests, execute the `pnpm test:integration` command.
