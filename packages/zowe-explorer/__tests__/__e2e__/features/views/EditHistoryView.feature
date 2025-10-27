Feature: Edit History Webview

Scenario: User opens the Edit History view from the command palette
  Given a user who is looking at the Zowe Explorer tree views
  # When the user opens the command palette and runs "List Data Sets" command
  When a user selects Edit History from the command palette
  Then a user can view the Edit History panel
  And navigate to the various Edit History tabs
    