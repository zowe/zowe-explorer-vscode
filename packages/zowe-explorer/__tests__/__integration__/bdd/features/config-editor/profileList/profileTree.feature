Feature: Profile Tree Verification

  @config-editor @profile-tree
  Scenario: Check that profile tree contains expected nodes
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile tree should contain expected profiles from zowe.config.json
