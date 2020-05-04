# VSCode extensions for Zowe Explorer

The Zowe Explorer provides extension points that assist third party extenders to create extensions that access Explorer entities and enrich the user experience. Extenders should consider there are two mechanisms available by which they extend Zowe Explorer. 
- VSCode provides extension points via the package.json file relating contextual strings with entity types and containers in the Zowe Explorer and is the way forward with menus for example.
- Zowe Explorer provides an evolving extenders API that provides specific access to Zowe functionality that for example enables the extender to interact with servers
using CLI profiles. The intention is to add more such API functions as they are identified as of value. 

## VSCode Extender Package

Extender packages are created as new VSCode extensions. For general information about VSCode extensions, visit the following links:

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
when the extender package is installed. This also ties the activate functionality of both packages enabling direct access to the Zowe Explorer API

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
        ..
        ..
   }     
```
Notice the syntax we use is for the context value or viewItem above is a regular expression as denoted by the "=~" equal test. Using regular expressions 
to describe context allows more meaning to be embedded in the context.

Additional contexts are being indicated by the use of a preceding underscore character. These need to be added in the Zowe Explorer so the process to get them added 
is by raising a [git issue](https://github.com/zowe/vscode-extension-for-zowe/issues) and requesting a specific hook.


## Zowe Explorer Extender API

The following code snippet shows how to gain access to the published Zowe Explorer extender API.

```javascript
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

Details about the functions available in the API can be found by looking in the [Zowe Explorer source](https://github.com/zowe/vscode-extension-for-zowe/blob/master/src/api/ZoweExplorerExtender.ts) 
Initially, the following access methods were added to provide access to the appropriate profiles.

```javascript
        /**
         * Used by other VS Code Extensions to access the primary profile.
         *
         * @param primaryNode represents the Tree item that is being used
         * @return The requested profile
         *
         */
        getProfile(primaryNode: IZoweTreeNode): IProfileLoaded;
        
        /**
         * Used by other VS Code Extensions to access an alternative
         * profile types that can be employed in conjunction with the primary
         * profile to provide alternative support.
         *
         * @param primaryNode represents the Tree item that is being used
         * @return The requested profile
         */
        getLinkedProfile(primaryNode: IZoweTreeNode, type: string): Promise<IProfileLoaded>;
```

## The relationship with CLI profiles

Zowe Explorer uses the Zowe CLI profiles that have been created by the user and accesses information via a primary profile such as z/OSMF

!["Primary Profile"](./images/ZE-basic.gif?raw=true "Primary Profile")

This diagram shows that information presented in the Zowe Explorer has been retrieved from a z/OS server via an instance of a z/OSMF profile. Because
Zowe Explorer embeds the Zowe CLI node modules it uses this profile in conjunction with the API layer of the CLI plugin to create the
displayed content and provide functionality such as menus and other options.

There are other sources of information that could be presented that are not available via the primary profile. Examples include specific vendor tools associated with Jobs, or functions that represent advanced file management. It is intented to we "open up" Zowe Explorer and allow alternative routes to access these supplementary sources. 
The basis of this extender's extension is to use an alternative secondary information source based upon an alternative Zowe CLI plugin extension. Zowe Explorer will manage the
relationship between a primary and secondary profiles and the Zowe Extender API provides methods to access both the primary profile and a secondary profile based on the type.   

The result is that from within the scope of the extender package it's possible to access function from either source.

!["Secondary Profile"](./images/ZE-extend.gif?raw=true "Secondary Profile")

The information can be presented via specific menu options or potentially via callback functions for example during a file open request. These access methods API's are  
based on extender requirements with ideas for new and additional API methods can be discussed via our Zowe slack channel or by raising a [git issue](https://github.com/zowe/vscode-extension-for-zowe/issues)  

## Associating Zowe CLI Profiles

Zowe Explorer was created based upon the Zowe CLI protocol for communication with RestAPI's on the server and continues to be the preferred way to access for accessing REST services. To allow extenders to bring their own 
Zowe CLI plugins there is a simple mechanism by which Zowe Explorers can associate profiles. The 'Primary' profile which is powering Zowe Explorer
can be linked with multiple 'Secondary' types although only a single instance of each type is allowed. 
Within the scope of their own extender package these profiles can be accessed so making access to the relevant REST API available to the extender.


![Profiles](./images/ZE-profile-links.gif?raw=true "Associate Profile")

## Futures WIP

### Extension Compliance
 
The Zowe project includes guidance about how extensions such as the CLI plugins should be compliant with Zowe. This is intended to be a mutual beneficial information that allows developed
items to be reliable and consistent with the look, feel and behavior. We intend to apply the same guidance to Zowe Explorer extensions but this needs to evolve with extender participation.  
[Progress Details here](https://github.com/zowe/vscode-extension-for-zowe/issues/672)

### Publishing extender API as an NPM repo

We are considering publishing the API as a npm repository that can be imported into the extenders package. [Progress Details here](https://github.com/zowe/vscode-extension-for-zowe/issues/671)
