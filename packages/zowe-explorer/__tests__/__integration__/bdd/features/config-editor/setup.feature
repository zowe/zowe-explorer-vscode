Feature: Open Zowe Config Editor from Command Palette

  Scenario: User launches Config Editor from Command Palette
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
