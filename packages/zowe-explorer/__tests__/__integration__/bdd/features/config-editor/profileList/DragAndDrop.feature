Feature: Drag and Drop functionality for tree items

  @config-editor @drag-drop
  Scenario: User drags zosmf1 profile to zosmf2 location
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list should be in tree view mode
    And the zosmf1 profile exists in the tree
    When the user clicks and holds on the zosmf1 profile
    And the user hovers over the zosmf2 location
    And the user releases the left click
    And the user clicks the save button
    Then the zosmf1 profile should be moved to the zosmf2 location in the config file
    And the profile should be visible in its new location
