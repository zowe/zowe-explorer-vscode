# Version 3.0.0 Changes Affecting Zowe Explorer Extenders

## Removal of deprecated APIs from Extensibility API for Zowe Explorer

- Logger type `MessageSeverity` in favor of `MessageSeverityEnum`.
- `IUss.putContents` in favor of `IUss.putContent`.
- `IJes.getJobsByOwnerAndPrefix` in favor of `IJes.getJobsByParameters`.
- `ICommand.issueTsoCommand` in favor of `ICommand.issueTsoCommandWithParms`.
- `ZoweVsCodeExtension.showVsCodeMessage` in favor of `Gui.showMessage`.
- `ZoweVsCodeExtension.inputBox` in favor of `Gui.showInputBox`.
- `ZoweVsCodeExtension.promptCredentials` in favor of `ZoweVsCodeExtension.updateCredentials`.
