# Zowe Explorer Conformance Evaluation Criteria (Version 2)

The Zowe Conformance Evaluation Criteria is a set of self-certifying and self-service tests to help the development community integrate and extend specific technology into the Zowe framework.

This document describes the requirements of the three available conformance programs. Items marked **(required)** are required for an application to be conformant. Items marked **(best practice)** are considered best practices for conformant applications.

For more details, technical guidance, and code samples for achieving these criteria see the [README-Extending.md](README-Extending.md).

Throughout this document you will find the following terminology being used:

- _Extender_: The organization or developer producing an extension for Zowe Explorer.
- _Zowe Explorer Extension_: An installable piece of software that provides new functionality to Zowe Explorer or uses/calls services provided by Zowe Explorer. Also simply referred to here as an "extension", this can be a VS Code extension as well as a Zowe CLI Plugin or an independent piece of software. The conformance criteria below call out conformance requirements for three common types of Zowe Explorer extensions, but it is possible that more kinds of extensions can be created. If such new extension kinds surface, then Zowe Explorer APIs and this document can be expanded to support them in the future.
- _Zowe Explorer VS Code extension_: Refers to a Zowe Explorer extension that is a VS Code extension that is installed in addition to Zowe Explorer and that has a VS Code extension dependency to Zowe Explorer.
- _Zowe SDKs_ are [SDKs published by the Zowe project](https://docs.zowe.org/stable/user-guide/sdks-using) that provides various APIs for writing Zowe-based capabilities in general.

These Zowe Conformance criteria are applicable to the latest Zowe v2 LTS Release.

- [Zowe Explorer - Zowe v2](#zowe-explorer---zowe-v2)
  - [General Extension](#general-extension)
  - [Extension Accessing Profiles](#extension-accessing-profiles)
  - [Data Provider Extension](#data-provider-extension)
  - [Extension Adding Menus](#extension-adding-menus)

## Zowe Explorer - Zowe v2

### General Extension

General conformance criteria for all extensions that add new capabilities to Zowe Explorer.

<table rules="all">
 <thead>
 <th style=background-color:#5555AA>Item </th>
 <th style=background-color:#5555AA>Ver </th>
 <th style=background-color:#5555AA>Required </th>
 <th style=background-color:#5555AA>Best Practice </th>
 <th style=background-color:#5555AA>Conformant </th>
 <th style=background-color:#5555AA>Criteria </th>
 </thead>

 <tr>
   <th style="background-color:#555555">1</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Naming:</b> If the extension uses the word "Zowe" in its name, it abides by The Linux Foundation <a href="https://www.linuxfoundation.org/trademark-usage/">Trademark Usage Guidelines</a> and <a href="https://www.openmainframeproject.org/branding-guidelines">Branding Guidelines</a> to ensure the word Zowe is used in a way intended by the Zowe community.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">2</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>No Zowe CLI plugin installation requirement: </b> If the extender makes use of a Zowe CLI profile other than the Zowe Explorer default `zosmf` then the extension must not make any assumptions that a matching Zowe CLI plugin has been installed in the Zowe Explorer user's environment.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">3</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Publication tag:</b> If the extension is published in a public catalog or marketplace such as Npmjs, Open-VSX, or VS Code Marketplace, it uses the tag or keyword "Zowe" so it can be found when searching for Zowe and be listed with other Zowe offerings.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">4</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Support:</b> Extension has documentation with instructions on how to report problems that are related to the extension and not Zowe Explorer. It needs to explain how users can determine if a problem is related to the extension or Zowe Explorer.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">5</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>User settings consistency:</b> Extender provides a consistent user settings experience. For VS Code extensions, extender follows the recommended naming convention for configuration settings as described in VS Code's <a href="https://code.visualstudio.com/api/references/contribution-points#contributes.configuration">configuration contribution documentation</a></td>
 </tr>

 <tr>
   <th style="background-color:#555555">6</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Using .zowe in user settings:</b> Extender avoids starting setting names with the prefix `zowe.`, which is reserved for Zowe Explorer and and other extensions maintained by the Zowe Project
.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">7</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>Error message consistency:</b> Extension follows the recommended error message format indicated in the <a href=https://github.com/zowe/zowe-explorer-vscode/blob/main/docs/extenders/Error%20Handling.md>Zowe Explorer extensibility documentation</a> to provide a consistent user experience with Zowe Explorer.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">8</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>Zowe SDK usage:</b> Extension utilizes the available Zowe SDKs that standardize z/OS interactions as well as other common capabilities that are used by many other Zowe extensions and tools unless the extension's goal is to provide a new implementation with clearly stated goals.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">9</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Sharing of profiles with Zowe CLI:</b> Extensions that utilize Zowe CLI profiles must keep the shared profile instances compatible between Zowe CLI and the Zowe Explorer extension that utilize them.</td>
 </tr>

 <tr>
   <th style="background-color:#555555" rowspan=5>10</th>
   <th style="background-color:#555555"></th>
   <th style="background-color:#AAAAAA" colspan=2>Mark all that apply,(a) (b) (c)</th>
   <th style="background-color:#AAAAAA"></th>
   <td style="text-align:center">Extension uses the extensibility APIs provided by Zowe Explorer. Supported methods include:<p style="color:red">(Please select all that apply)</td>
 </tr>
 <tr>
   <th style="background-color:#555555"></th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA" ></th>
   <th></th>
  <td>a. Extension Accessing Profiles</td>
 </tr>
 <tr>
   <th style="background-color:#555555"></th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA" ></th>
   <th></th>
  <td>b. Data Provider Extension</td>
 </tr>
 <tr>
   <th style="background-color:#555555"></th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA" ></th>
   <th></th>
  <td>c. Extension Adding Menus</td>
 </tr>
</table>

### Extension Accessing Profiles

Criteria for VS Code extensions that want to access the same Zowe CLI profiles that Zowe Explorer uses.

<table rules="all">
 <thead>
 <th style=background-color:#5555AA>Item </th>
 <th style=background-color:#5555AA>Ver </th>
 <th style=background-color:#5555AA>Required </th>
 <th style=background-color:#5555AA>Best Practice </th>
 <th style=background-color:#5555AA>Conformant </th>
 <th style=background-color:#5555AA>Criteria </th>
 </thead>

 <tr>
   <th style="background-color:#555555">11</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>VS Code extension dependency:</b> If the extension calls the Zowe Explorer API it must declare Zowe Explorer as a VS Code extension dependency by including an <b>extensionDependencies</b> entry for Zowe Explorer in its package.json file. <em>This ensures  Zowe Explorer and Zowe Explorer API are activated and initialized for proper use by its extenders</em></td>
 </tr>

  <tr>
   <th style="background-color:#555555">12</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Zowe Extender access:</b> Extension accesses the shared Zowe Explorer profiles cache via `ZoweExplorerApi.IApiRegisterClient.getExplorerExtenderApi()` API as documented in the <a href=https://github.com/zowe/zowe-explorer-vscode/blob/main/docs/README-Extending.md#using-the-zowe-explorer-profilescache-for-an-extenders-own-unrelated-profiles>Zowe Explorer extensibility documentation.</td>
 </tr>

  <tr>
   <th style="background-color:#555555">13</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Added Profile Type initialization:</b> If the extension has a dependency on a new Zowe CLI profile type other than the Zowe Explorer default `zosmf`, it is calling the `ZoweExplorerApi.IApiRegisterClient.getExplorerExtenderApi().initialize(profileTypeName)` to ensure that the profile type is supported and managed by the extension without a Zowe CLI plugin installed.</td>
 </tr>
 <tr>
   <th style="background-color:#555555">14</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>Base Profile and Tokens:</b> Extension supports <a href=https://docs.zowe.org/stable/user-guide/cli-usingcli/#base-profiles>base profiles</a> and <a href=https://docs.zowe.org/stable/user-guide/cli-usingcli#integrating-with-api-mediation-layer>tokens</a></td>
 </tr>

 <tr>
   <th style="background-color:#555555">15</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Team Configuration File:</b> Extension supports the Zowe CLI 7 team configuration file format.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">16</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>v1 Profile Support:</b> Extension has a backwards compatibility and it is able to support v1 type of profiles.</td>
 </tr>
</table>

### Data Provider Extension

Criteria for VS Code extensions that extend the Zowe Explorer MVS, USS, or JES tree views to use alternative z/OS interaction protocols such as FTP or a REST API.

<table rules="all">
 <thead>
 <th style=background-color:#5555AA>Item </th>
 <th style=background-color:#5555AA>Ver </th>
 <th style=background-color:#5555AA>Required </th>
 <th style=background-color:#5555AA>Best Practice </th>
 <th style=background-color:#5555AA>Conformant </th>
 <th style=background-color:#5555AA>Criteria </th>
 </thead>

 <tr>
   <th style="background-color:#555555">17</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>VS Code extension dependency:</b> If the extension calls the Zowe Explorer API it must declare Zowe Explorer as a VS Code extension dependency by including an <b>extensionDependencies</b> entry for Zowe Explorer in its package.json file. <em>This ensures  Zowe Explorer and Zowe Explorer API are activated and initialized for proper use by its extenders</td>
</tr>

<tr>
   <th style="background-color:#555555">18</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>New Zowe CLI profile type:</b> Extension registers its new API instances with a new profile type name for the different Zowe Explorer views via the `ZoweExplorerApi.IApiRegisterClient.register{Mvs|Uss|Jes}Api(profileTypeName)` call as indicated from the <a href=https://github.com/zowe/zowe-explorer-vscode/blob/main/docs/README-Extending.md#using-the-zowe-explorer-profilescache-for-an-extenders-own-unrelated-profiles>Zowe Explorer extensibility documentation</a></td>
 </tr>

 <tr>
   <th style="background-color:#555555">19</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>Matching Zowe CLI Plugin:</b> Provide a Zowe CLI Plugin for the data provider's new profile type that implements the core capabilities required for the new protocol that users can then also use to interact with the protocol outside of the Zowe Explorer extension using Zowe CLI commands.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">20</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Data provider API implementation:</b> Extension fully implements and registers to at least one of the three Zowe Explorer interfaces or alternatively throw exceptions that provide meaningful error messages to the end-user in the 'Error.message' property that will be displayed in a dialog.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">21</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>API test suite implementation:</b>  If the extension implements a Zowe Explorer API data provider interface, it should implement a test suite that calls each of the implemented API methods.</td>
 </tr>
</table>

### Extension Adding Menus

Criteria for VS Code extensions adding menu and commands to VS Code that utilize Zowe Explorer data or extend Zowe Explorer capabilities.

<table rules="all">
 <thead>
 <th style=background-color:#5555AA>Item </th>
 <th style=background-color:#5555AA>Ver </th>
 <th style=background-color:#5555AA>Required </th>
 <th style=background-color:#5555AA>Best Practice </th>
 <th style=background-color:#5555AA>Conformant </th>
 <th style=background-color:#5555AA>Criteria </th>
 </thead>

 <tr>
   <th style="background-color:#555555">22</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>VS Code extension dependency:</b> If the extension calls the Zowe Explorer API it should declare Zowe Explorer as a VS Code extension dependency by including an <b>extensionDependencies</b> entry for Zowe Explorer in its package.json file. <em>This ensures  Zowe Explorer and Zowe Explorer API are activated and initialized for proper use by its extenders</em></td>
 </tr>

 <tr>
   <th style="background-color:#555555">23</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Command operations: </b> If the extension is adding new commands to Zowe Explorer's tree views, the commands must not replace any existing Zowe Explorer commands.</td>
 </tr>

  <tr>
   <th style="background-color:#555555">24</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>Command categories 1: </b>  If the extension adds to <code>contributes.commands</code> in <code>package.json</code>, the value assigned to the <code>category</code> property contains the extension name.</td>
 </tr>

 <tr>
   <th style="background-color:#555555">25</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Command categories 2: </b>  If the extension assigns values to the <code>category</code> property in <code>contributes.commands</code> in <code>package.json</code>, the value cannot be "Zowe Explorer".</td>
 </tr>

  <tr>
   <th style="background-color:#555555">26</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Context menu groups: </b> If contributing commands to Zowe Explorer's context menus, the extension follows the <a href=https://github.com/zowe/zowe-explorer-vscode/blob/main/docs/README-Extending.md#grouping-menu-commands>Zowe Explorer extensibility documentation</a> and adds them in new context menu groups that are located below Zowe Explorer's existing context menu groups in the user interface.</td>
 </tr>

  <tr>
   <th style="background-color:#555555">27</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA"></th>
   <th style="background-color:#AAAAAA">x</th>
   <th></th>
   <td><b>Adding New Menu Items:</b> If the extension is adding new commands and context menu entries to the Zowe Explorer tree view nodes, the new command name is consistent with the terminology and naming conventions of the existing Zowe Explorer menu entries. More information is provided in the <a href=https://github.com/zowe/zowe-explorer-vscode/blob/main/docs/README-Extending.md#creating-an-extension-that-adds-menu-commands
>Zowe Explorer extensibility documentation.</a></td>
 </tr>

   <tr>
   <th style="background-color:#555555">28</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Existing Menu Items:</b> Extension does not overwrite any existing Zowe Explorer command and context menu entries
</td>
 </tr>

 <tr>
   <th style="background-color:#555555">29</th>
   <th style="background-color:#555555">v2</th>
   <th style="background-color:#AAAAAA">x</th>
   <th style="background-color:#AAAAAA"></th>
   <th></th>
   <td><b>Context menu items: </b> If contributing commands to Zowe Explorer's views (such as Data Sets, USS, or Jobs), the extension should only add them to the view's right-click context menus.</td>
 </tr>
</table>
