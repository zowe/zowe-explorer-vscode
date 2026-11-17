# Contribution Guidelines

This document is intended to be a living summary of conventions & best practices for development of the Visual Studio Code Extension for Zowe.

## Primary Contribution Guidelines

The following information is critical to working with the code, running/writing/maintaining automated tests, developing consistent syntax in your plug-in, and ensuring that your plug-in integrates with Zowe CLI properly:

| For more information about ...                                                 | See:                                                                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| General guidelines that apply to contributing to Zowe CLI and Plug-ins         | [Contribution Guidelines](https://github.com/zowe/zowe-cli/blob/master/CONTRIBUTING.md)                            |
| Conventions and best practices for creating packages and plug-ins for Zowe CLI | [Package and Plug-in Guidelines](https://github.com/zowe/zowe-cli/blob/master/docs/PackagesAndPluginGuidelines.md) |
| Guidelines for running tests on Zowe CLI                                       | [Testing Guidelines](https://github.com/zowe/zowe-cli/blob/master/docs/TESTING.md)                                 |
| Guidelines for running tests on the plug-ins that you build for Zowe CLI       | [Plug-in Testing Guidelines](https://github.com/zowe/zowe-cli/blob/master/docs/PluginTESTINGGuidelines.md)         |
| Documentation that describes the features of the Imperative CLI Framework      | [About Imperative CLI Framework](https://github.com/zowe/imperative/wiki)                                          |
| Versioning conventions for Zowe CLI and Plug-ins                               | [Versioning Guidelines](https://github.com/zowe/zowe-cli/blob/master/docs/MaintainerVersioning.md)                 |

## Contribution Guidelines Specific to the VSC Extension for Zowe

The following guidelines apply specifically to the extension:

### Zowe SDK updates

The **Zowe SDK Compatibility** workflow posts a compatibility-review reminder when a PR raises a declared `@zowe/*-for-zowe-sdk` or `@zowe/imperative` dependency's major or minor version in a root or `packages/**/package.json` manifest. It compares pinned, caret (`^`), and tilde (`~`) versions; patch-only changes, newly added dependencies, and lockfile-only updates do not trigger a reminder.

The workflow maintains one comment per PR and removes it if the qualifying updates are reverted. It reads manifests through the GitHub API without checking out or executing PR code, including for fork PRs. The comment is a review reminder, not proof of compatibility: review upstream release notes, verify affected Explorer and extender behavior, and record the results before completing the PR's dependency compatibility checkbox.
