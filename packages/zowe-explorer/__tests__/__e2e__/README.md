# Zowe Explorer End-to-end Testing

This folder contains a set of end-to-end test scenarios that require a test system to run. End-to-end testing ensures that the intended behavior is met without stubbing or mocking chunks of code for a given scenario.

## Creating a Zowe team config

Create a Zowe team config using Zowe CLI or Zowe Explorer and copy it into its own directory for running the end-to-end tests.
Ensure that the config has the following:

- z/OSMF, TSO and SSH profiles are defined in `defaults` section of the config
- All 3 profiles should have their required properties for connecting to a remote system
- Valid TSO account number in the TSO profile properties
- Valid port for SSH in the SSH profile properties
- User and password stored securely for the profiles **in advance** OR user/password specified as properties in a base profile

**Note:** If you need to write a test that involves mocking or stubbing an object, consider writing an [integration test using Mocha](../__integration__/README.md) instead.

## Preparing your environment

Refer to the `.env.example` file in this folder to create a `.env` file that will be used for end-to-end-testing.  
The environment file must contain valid definitions for all variables specified in the example, or an error may occur while running the tests.

## Run tests

After creating and preparing a `.env` file in this folder to meet the above requirements, run the tests by executing the `pnpm test:e2e` command.
