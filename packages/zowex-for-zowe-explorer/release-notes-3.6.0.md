## 3.6.0

### Integration with Zowe Remote SSH

Zowe Remote SSH is now directly integrated into Zowe Explorer.
To migrate your settings:

- Replace the VSCode setting `zowex-vsce.requestTimeout` with `zowe.settings.requestTimeout`.
- Replace all other VSCode settings that begin with `zowex-vsce` with `zowe.zowex`.
