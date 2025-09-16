Feature: Profile Tree Verification

  Scenario: Check that profile tree contains expected nodes
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile tree should contain 4 nodes with titles "zosmf1", "zosmf2", "zosmf3", "base"
