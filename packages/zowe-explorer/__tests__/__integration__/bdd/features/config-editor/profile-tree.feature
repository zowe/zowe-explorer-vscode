Feature: Profile Tree Verification

  Scenario: Check that profile tree contains expected nodes
    When a user opens the Zowe Config Editor from the Command Palette
    Then I wait for 30 seconds
    Then the Zowe Config Editor webview should be opened
    And the profile tree should contain 3 nodes with titles "test1", "test2", "test3"
