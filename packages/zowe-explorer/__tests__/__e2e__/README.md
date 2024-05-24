# Zowe Explorer End-to-end Testing

This folder contains a set of end-to-end test scenarios that require a test system to run. End-to-end testing ensures that the intended behavior is met without stubbing or mocking chunks of code for a given scenario.

**Note:** If you need to write a test that involves mocking or stubbing an object to reproduce the desired behavior, consider writing an [integration test](../__integration__/README.md) instead.

## Preparing your environment

Refer to the `.env.example` file in this folder to create a `.env` file that will be used for end-to-end-testing.

The environment file must contain the following variables:

```bash
# Path to Zowe home folder where configurations are stored (relative to current directory or an absolute path)
ZOWE_TEST_DIR=".zowe"

# Profile variables
ZE_TEST_PROFILE_NAME="<profileName>" # The name of the profile in your Zowe config to use for testing
ZE_TEST_PROFILE_USER="testUser" # The user to leverage during the e2e tests

# USS variables
ZE_TEST_USS_FILTER="/u/users/testUser" # The filter to apply when searching on a USS profile
ZE_TEST_USS_DIR="test" # The USS directory to use for edit and list testing - should be relative to USS filter
ZE_TEST_USS_FILE="testFile.txt" # The USS file to edit and save with, relative to USS dir

# Data Set variables
ZE_TEST_DS_FILTER="TESTUSER.*" # The filter to apply when searching on a Data Sets profile
ZE_TEST_PDS="TESTUSER.C" # The PDS to use for edit and list testing - must be matched by the defined filter
ZE_TEST_PDS_MEMBER="TESTC" # The PDS member to use for edit and list testing - relative to the defined PDS
ZE_TEST_PS="TESTUSER.TESTPS" # The PS to use for editing - must be mathced by the defined filter
```

## Run tests

After creating and preparing a `.env` file in this folder to meet the above requirements, run the tests by executing the `pnpm test:e2e` command.
