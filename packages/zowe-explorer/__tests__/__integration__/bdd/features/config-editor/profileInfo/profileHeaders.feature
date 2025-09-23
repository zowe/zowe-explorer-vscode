Feature: Profile Headers Buttons (show merged, rename, delete, set as default)

  Background:
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list is set to flat view mode

  Scenario: Test profile header buttons
  # Test 1: Set profile as default and verify configuration
  When the user clicks on the "test-profile" profile entry
  And the user clicks the "set as default" button
  And the user saves the changes
  Then the zowe.config.json should have "test-profile" as the default base profile

  # Test 2: View profile properties and toggle merged properties
  When the user clicks on the "nested.child1" profile entry
  Then the profile selection should be successful
  Then there should be 4 profile properties
  When the user clicks the "hide merged properties" button
  Then there should be 2 profile properties
  Then the hide merged properties button click should be successful

  # Test 3: Rename a profile
  When the user clicks on the "zosmf-dev" profile entry
  When the user clicks the "rename profile" button
  When the user appends "_test" to the profile name in the modal
  When the user clicks the "rename confirm" button
  When the user clicks on the "nested.child2" profile entry
  When the user clicks the "rename profile" button
  When the user appends "_test" to the profile name in the modal
  When the user clicks the "rename confirm" button
  And the user saves the changes
  Then close the webview workbench
  Then the profile tree should contain expected profiles from zowe.config.json with proper renames

  # Test 4: Delete a profile
  When the user clicks on the "zosmf-dev_test" profile entry
  When the user clicks the "delete profile" button
  When the user clicks on the "nested.child2_test" profile entry
  When the user clicks the "delete profile" button
  And the user saves the changes
  Then close the webview workbench
  Then the profile tree should contain expected profiles from zowe.config.json with proper deletions