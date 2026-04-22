# Change Log

All notable changes to the "zowex-vsce" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## Recent Changes

- **Breaking:** Renamed contributed setting IDs from `zowe-native-proto` to `zowex`. All references to `zowe-native-proto` should be replaced with `zowex` in VS Code `settings.json` files. [#831](https://github.com/zowe/zowex/issues/831)

## `0.4.0`

- Added error correlation for expired z/OS password (`FOTS1668`/`FOTS1669`), surfacing actionable tips and documentation links in Zowe Explorer when SSH commands fail due to an expired password. [#867](https://github.com/zowe/zowex/pull/867)
- Updated **Show Attributes** to display member ISPF statistics [#630](https://github.com/zowe/zowex/issues/630)
- Improved Error Message handling and actions when encountering unrecoverable errors in `zowex`. [#548](https://github.com/zowe/zowex/issues/548)
- Added the functionality for the **Rename** option in the USS tree. [#820](https://github.com/zowe/zowex/pull/820)
- Added the functionality to move files in the USS tree. [#820](https://github.com/zowe/zowex/pull/820)
- Added the functionality to copy USS files and directories. [#379](https://github.com/zowe/zowex/pull/379).
- Added experimental native client for improved performance which can be enabled via a VS Code setting. [#833](https://github.com/zowe/zowex/pull/833)

## `0.3.0`

- Used new SDK groupings that align with zowex. [#807](https://github.com/zowe/zowex/issues/807)
- Added support for passing member patterns when filtering data sets. [#817](https://github.com/zowe/zowex/pull/817)

## `0.2.4`

- Added the functionality for the **Rename Member** option. [#765] (https://github.com/zowe/zowex/pull/765).
- Added the `multivolume` (`mvol`) property when displaying data set attributes. [#782](https://github.com/zowe/zowex/pull/782)
- Fixed an issue where using the "Upload Member" option with an SSH profile in Zowe Explorer caused an error. Now, the member name is provided to the back end for each member that is uploaded. [#785](https://github.com/zowe/zowex/issues/785)

## `0.2.3`

- Added the functionality for the **Rename Data Set** option. [#376](https://github.com/zowe/zowex/issues/376)
- Fixed an issue where the Zowe Explorer "Submit as JCL" command displayed `undefined` as the job name within the "Job submitted" notification. Now, the job name and ID are present in the information message. [#733](https://github.com/zowe/zowex/issues/733)
- Updated the server installation process to locate server PAX bundled in the SDK package. [#760](https://github.com/zowe/zowex/pull/760)

## `0.2.2`

- Fixed an issue where prompts could disappear when VS Code window loses focus while connecting to a new host. [#710](https://github.com/zowe/zowex/pull/710)
- Fixed an issue where `usedp` attribute was not hidden in "Show Attributes" webview when its value is undefined. [#712](https://github.com/zowe/zowex/pull/712)
- Fixed an issue where listing data sets could silently fail when there is an authentication error. [#721](https://github.com/zowe/zowex/pull/721)

## `0.2.1`

- Updated error handling to format request timeout errors. When a timeout error is received, the request is cancelled and the user receives a notification with context of where the error occurred. [#416](https://github.com/zowe/zowex/issues/416)
- When listing data sets with attributes, a comprehensive set is now retrieved that is similar to what ISPF displays. [#629](https://github.com/zowe/zowex/issues/629)
- Fixed profile validation hanging after deployment error. [#691](https://github.com/zowe/zowex/pull/691)

## `0.2.0`

- Renamed `SshConfigUtils` class to `ConfigUtils` to avoid naming conflicts with SDK files [#614](https://github.com/zowe/zowex/pull/614)
- Added new `defaultHandshakeTimeout` VS Code setting to allow users to customize the handshake timeout when not specified in the profile. [#605](https://github.com/zowe/zowex/pull/605)
- Fixed SSH client caching to be per profile instead of per hostname, allowing multiple server instances on the same system. [#558](https://github.com/zowe/zowex/pull/558)
- Updated RPC response types for data set operations to align with SDK changes. [#590](https://github.com/zowe/zowex/pull/590)
- Added support for issuing TSO commands. [#595](https://github.com/zowe/zowex/pull/595)
- Fixed an issue where the input validation for the deploy directory prompt would falsely detect paths as invalid. [#609](https://github.com/zowe/zowex/issues/609)

## `0.1.10`

- Updated the `Zowe-SSH: Connect to Host...` command to prompt the user to choose a deploy directory. [#527](https://github.com/zowe/zowex/issues/527)

## `0.1.9`

- Moved `showSessionInTree` call to before `uninstallServer` is called to ensure the session is displayed in the tree before the uninstall removes it. [#484](https://github.com/zowe/zowex/issues/484)
- Filtered out certain information messages to display a clear and concise error message for when creating a data set with an invalid management class. [#502](https://github.com/zowe/zowex/issues/502)
- Added "Worker Count" setting to configure number of `zowex` worker threads. [#514](https://github.com/zowe/zowex/pull/514)
- Fixed error when using SSH profiles in Zowe Explorer 3.3.0. [#540](https://github.com/zowe/zowex/issues/540)
- Fixed an issue where the `Zowe-SSH: Connect to Host...` command did not prompt the user for a password if the given private key was not recognized by the host. [#524](https://github.com/zowe/zowex/issues/524)
- Added a new prompt that shows if the user has an invalid private key on an existing profile when running the `Zowe-SSH: Connect to Host...` command. Now, if an invalid private key is detected, it is moved to a new comment in the JSON file and the user is given options to proceed. They can undo the comment action, delete the comment entirely, or preserve the comment and succeed with setup. [#524](https://github.com/zowe/zowex/issues/524)
- Added a new error handler that integrates with Zowe Explorer to provide detailed troubleshooting information for connection failures, authentication issues, and server deployment problems. When an error occurs, a dialog is now displayed with a summary of the problem, actionable tips, and links to relevant documentation. [#228](https://github.com/zowe/zowex/issues/228)

## `0.1.7`

- Fixed regression in performance where opening data sets and USS files in the editor could be slow. [#488](https://github.com/zowe/zowex/pull/488)

## `0.1.6`

- Fixed regression where USS download operations would fail because of a missing callback function. [#482](https://github.com/zowe/zowex/issues/482)

## `0.1.5`

- Implemented the `getTag` function in the `SshUssApi` class to return the tag of a UNIX file. Now, the VS Code extension automatically detects the file tag before the file is opened, and the detected encoding is shown in the "Open with Encoding" menu in Zowe Explorer. [#346](https://github.com/zowe/zowex/issues/346)
- Adopted streaming for API methods that upload/download data sets and USS files. [#358](https://github.com/zowe/zowex/pull/358)

## `0.1.2`

- Enhanced SSH profile validation to auto-deploy server when it is missing or out of date. [#44](https://github.com/zowe/zowex/issues/44)
- Added keep-alive messages to keep SSH connection active. Their frequency can be controlled with the "Keep Alive Interval" option. [#260](https://github.com/zowe/zowex/issues/260)

## `0.1.1`

- Fixed issue where a jobs list request returns unexpected results whenever a search query does not match any jobs. [#217](https://github.com/zowe/zowex/pull/217)
- Fixed issue where data set save requests sometimes resulted in an unexpected conflict error. [#219](https://github.com/zowe/zowex/pull/219)
- Fixed issue where Server Install Path setting did not work. [#220](https://github.com/zowe/zowex/pull/220)

## `0.1.0`

- Fixed issue where `Open with Encoding: Binary` for MVS and USS files did not pass the correct encoding value to the server. [#61](https://github.com/zowe/zowex/pull/61)
- Added support for cancelling jobs. [#138](https://github.com/zowe/zowex/pull/138)
- Added support for running MVS commands. [#138](https://github.com/zowe/zowex/pull/138)
- Updated error handling for listing data sets. [#185](https://github.com/zowe/zowex/pull/185)
- Added support for conflict detection through use of e-tags. When a data set or USS file is opened, the e-tag is received by the VS Code extension and used in future write requests to prevent overwriting new changes on the target system. [#144](https://github.com/zowe/zowex/issues/144)

## [Unreleased]

- Initial release
