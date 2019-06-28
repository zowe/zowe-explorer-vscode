# Install, Build, and Test the Extension

Developers can install the Visual Studio Code Extension for Zowe, which lets users interact with z/OS data sets on a remote mainframe instance, from a VSIX file and run system tests on the extension.

## Contents

- [Install to VSC from source](#install-to-vsc-from-source)
- [Run System Tests](#run-system-tests)

## Install to VSC from source

You can build the extension (VSIX file) from this source repository and install it to VSC.  

**Important!** Follow the [instructions  for creating testProfileData.ts](#run-system-tests) before performing these steps.

### Build the extension

From your local copy of this repository, issue the following commands to create the VSIX package file from source:

1. `npm install`
2. `npm run package`
   This creates a `.vsix` file in your local copy of the project.

### Install the extension to VSC

After you create a VSIX file, install the extension to VSC:

1. Navigate to the Extensions menu in Visual Studio Code and click the **...** menu on the top-left. 
2. Select Install from VSIX and select the `.vsix` file that was created by your `npm run package` command. 
3. Restart Visual Studio Code.

The extension is installed.

## Run System Tests

The following topics describe how to run system tests on the Visual Studio Code extension.

### Test Profile Data

In your copy of this repository, create a `testProfileData.ts` file in the `resources` directory. In this file, include the following text with your credentials:

```typescript
import { IProfile } from "@brightside/imperative";

export const profile: IProfile = {
    type : "zosmf",
    host: "",
    port: 0,
    user: "",
    pass: "",
    rejectUnauthorized: false,
    name: "" // @NOTE: This profile name must match an existing zowe profile in the ~/.zowe/profiles/zosmf folder
};

export const normalPattern = "";
export const orPattern = "";
```

**Note:** You can copy the above example content from `./resources/testProfileData.example.ts`.

#### Normal pattern

To test the extension, the mainframe data sets under `normalPattern` must match the following structures:

- `normalPattern` + ".EXT.PDS"
  - "MEMBER"
- `normalPattern` + ".EXT.PS"
- `normalPattern` + ".EXT.SAMPLE.PDS"
- `normalPattern` + ".PUBLIC.BIN"
- `normalPattern` + ".PUBLIC.TCLASSIC"
  - "NEW"
- `normalPattern` + ".PUBLIC.TPDS"
  - "TCHILD1"
  - "TCHILD2"
- `normalPattern` + ".PUBLIC.TPS"

The `./scripts` folder contains the following scripts to help you set up the required file structure. You can execute the scripts when the `ts-node` package is installed globally.

- [create-env](/scripts/create-env.ts): Creates the proper data sets on the mainframe.
- [clean-env](/scripts/clean-env.ts): Cleans up the data sets created on the mainframe.

**Note:** The scripts use the profile that you specified in `testProfileData`.

##### Execute the setup scripts

1. Issue the following command to install `ts-node` globally:

    `npm install -g ts-node`

2. Issue the following command to execute script as if it were a node script.

    `ts-node ./scripts/clean-env.ts` or `ts-node ./scripts/create-env.ts`

#### Or pattern

There is no required structure for the mainframe data sets under `orPattern`.

### Executing from VSC

1. To run the tests, open your copy of the repository in VSC, [build the extension](#build-the-extension), and open the **Debug** panel on the left.

2. From the drop-down next to the green play button, click **Integration Tests Mocha** and click the **Play** button.

  The tests run and the output goes to your VSC debug console. 

### Profile notes

- As mentioned in the example test properties file, there must be at least one valid zosmf profile corresponding to the name in your properties file.

  **Example:** When your test properties define a profile named `test-vscode-extension`, a corresponding profile should exist in the `.zowe` profiles directory of your `zowe-cli`. The profile definitions **must** be identical to allow your tests to execute properly.
- The tests need at least two profiles to work properly. The second profile does not require valid credentials, however, it must exist on disk.

### Editing Strings for Localization
All localized strings must be string literals, you cannot include variables or use template literals within the argument you provide to the localize function.

#### Adding Strings
- First create a new key for your string. Existing keys follow the convention of including the functions/properties the string is nested in and a short one/two word description of the string.
- If you want to add a new string to the package.json file, replace the string with your key wrapped around by \% __key__ \% i.e. `"This is a string" -> "%exampleProperty.exDescription%"`
Then go to the package.nls.json file found in the root directory and include your newly created key and string inside as a json key/value pair.
- If you want to add a new string to a typescript file, you will need to include the following library in you file (if not already included). `import * as nls from 'vscode-nls';` You will also need to include the following function
```
const localize = nls.config({ messageFormat: nls.MessageFormat.file })(); 
```
Next wrap your string with the localize function in this format
`localize('key', 'string') i.e. localize('addEntry','Successfully called add entry.')`
Add the key and string as a json key/value pair to the  _filename_.i18n.json file that corresponds with the file you are adding the string to.

#### Removing Strings
- When removing strings, remove the key/value pair from its corresponding .json file (either package.nls.json or _filename_.i18n.json)

#### Changing Strings
- When changing strings, make the same change to the key/value pair from its corresponding .json file (either package.nls.json or _filename_.i18n.json)

### How to Donate Translations
1. Click [here](https://translate.zanata.org/?dswid=8786) and follow instructions under Sign Up heading to sign up to Zatana.
2. Send an email to evann.wu@ibm.com with the email heading as ZATANA TRANSLATOR REQUEST and include the following information in the body of the email.
    1. Zatana username
    2. Language(s) you wish to translate
    3. Affiliation with Zowe
3. You should receive a response within 3 days and be added to the Zatana Zowe VS Code Extension project. Click [here](http://docs.zanata.org/en/release/user-guide/translator-guide/) for more information about how to use Zanata to translate.

