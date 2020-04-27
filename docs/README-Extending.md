# Extending Zowe Explorer

The Zowe Explorer provides methods to enable third party extensions to interface with Explorer entities enriching the user experience.

## Extender Package

Extender packages are created as new VSCode extensions. Details for which can be found via the links below

- [Using extensions in Visual Studio Code](https://code.visualstudio.com/docs/introvideos/extend) 
- [VSCode Extension API](https://code.visualstudio.com/api) 
- [vscode-extension-samples](https://github.com/Microsoft/vscode-extension-samples) 

When creating an extension for Zowe Explorer it is necessary to specify that dependency in the package.json file as follows:
```json	
    "extensionDependencies": [
		"zowe.vscode-extension-for-zowe"
	],

```
The addition of this script also enforces that the Zowe Explorer is a pre-requisite package on the users machine which will install it if necessary 
when the extender package is installed. This also ties the activate functionality of both packages which enables access to the Zowe Explorer API

## Contextual Hooks

To enable menus, extenders can reference the context values associated with the individual Tree Items. Zowe Explorer uses a strategy of adding and removing 
elements of context to the individual context values if that imparts additional information that could assist with menu triggers. In the example below we
are referencing a Job type tree item that has additional information indicated by the *_rc* context. This can be used by an extender to trigger a specifc menu.   

```json
		"menus": {
			"view/item/context": [
				{
					"when": "view == zowe.jobs && viewItem =~ /^job.*/ && viewItem =~ /^.*_rc=CC.*/",
					"command": "zowe.testmule.retcode",
					"group": "4_workspace"
				}
            ],
```
Notice the syntax we use is for the context value or viewItem above is a regular expression as denoted by the "=~" equal test. It's the seof regualt expressions 
that allows us to embed multiple meaning in the context.

The additional context are indicataed by being preceded by an underscore character. These need to be added in the Zowe Explorer so the process to get them added 
is by raising a git issue againast Zowe Explorer and asking for them.


## Zowe Explorer API

The following code snippet shows how to gain access to the published Zowe Explorer extender API.

```typescript
export function activate(context: vscode.ExtensionContext) {
    const EXTENDER_API;
    const baseExt = vscode.extensions.getExtension('zowe.vscode-extension-for-zowe');
    try {
        if (baseExt && baseExt.exports) {
            EXTENDER_API = baseExt.exports.getExplorerExtenderApi();
            return;
        }
    } catch (error) {
        vscode.window.showWarningMessage("Unable to access Zowe Explorer API");
    }
}
```

Details of function available in the Api can be found by looking in the [Zowe Explorer source](https://github.com/zowe/vscode-extension-for-zowe/blob/master/src/api/ZoweExplorerApiRegister.ts)

## Use of Zowe CLI Profiles

Zowe Explorer is built on Zowe CLI which is the preferred method for accessing additional REST services. To allow extenders to bring their own 
Zowe CLI plugins there is a simple mechanism by which Zowe Explorers can associate profiles. The 'Primary' profile which is powering Zowe Explorer
can be linked with multiple 'Secondary' types. But at this time only a single instance of each type is allowed. 
from within their own extender package these profiles can be requested and so making access to the relevant REST API available.

![Profiles](./images/ZE-profile-links.gif?raw=true "Associate Profile")

## Futures WIP

It is intended to publish the API as a npm repository that can be imported into the extenders package. [Progress Details here](https://github.com/zowe/vscode-extension-for-zowe/issues/671)

