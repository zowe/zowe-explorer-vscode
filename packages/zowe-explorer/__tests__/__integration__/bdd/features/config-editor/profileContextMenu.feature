@config-editor @profile-context-menu
Feature: Context menu actions on profile tree items

  Background:
    Given the zowe team config file is restored from backup

  Scenario: Tree items expose actions and disable Paste until a profile is copied
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the Config Editor tutorial is closed
    When the user switches to tree view mode
    And the user opens the context menu on tree profile "nested"
    Then the tree profile context menu offers these options
      | option    | state    |
      | Cut       | enabled  |
      | Copy      | enabled  |
      | Paste     | disabled |
      | Duplicate | enabled  |
      | Rename    | enabled  |
      | Delete    | enabled  |
    When the user dismisses the tree profile context menu
    Then there are no pending changes in the Config Editor

  Scenario Outline: Copy a subtree and paste it through a tree item context menu
    When the user selects the "Global Team" configuration tab
    And the user refreshes the Config Editor from disk
    And the user switches to tree view mode
    Given the saved subtree "nested" in "Global Team" is captured for context menu testing
    When the user opens the context menu on tree profile "nested"
    And the user chooses "Copy" from the tree profile context menu
    Then there are no pending changes in the Config Editor
    When the user opens the context menu on tree profile "zosmf2"
    Then the tree profile context menu offers these options
      | option              | state   |
      | Cut                 | enabled |
      | Copy                | enabled |
      | Paste as Child      | enabled |
      | Paste at Root Level | enabled |
      | Duplicate           | enabled |
      | Rename              | enabled |
      | Delete              | enabled |
    When the user chooses "<option>" from the tree profile context menu
    Then tree profile "<destination>.child1" is visible
    And tree profile "<destination>.child2" is visible
    And there are pending changes in the Config Editor
    And the saved subtree "<destination>" in "Global Team" is absent
    When the user saves the changes
    Then the saved subtree "<destination>" in "Global Team" matches the captured subtree
    And the saved subtree "nested" in "Global Team" matches the captured subtree

    Examples:
      | option              | destination   |
      | Paste as Child      | zosmf2.nested |
      | Paste at Root Level | nested_1      |

  Scenario: Duplicate, rename and delete a subtree using tree item context menus
    When the user selects the "Global Team" configuration tab
    And the user refreshes the Config Editor from disk
    And the user switches to tree view mode
    Given the saved subtree "nested" in "Global Team" is captured for context menu testing
    When the user opens the context menu on tree profile "nested"
    And the user chooses "Duplicate" from the tree profile context menu
    Then tree profile "nested_copy.child1" is visible
    And tree profile "nested_copy.child2" is visible
    When the user saves the changes
    Then the saved subtree "nested_copy" in "Global Team" matches the captured subtree
    When the user opens the context menu on tree profile "nested_copy"
    And the user chooses "Rename" from the tree profile context menu
    And the user appends "_renamed" to the profile name in the modal
    And the user clicks the "rename confirm" button
    And the user saves the changes
    Then the saved subtree "nested_copy_renamed" in "Global Team" matches the captured subtree
    And the saved subtree "nested_copy" in "Global Team" is absent
    When the user opens the context menu on tree profile "nested_copy_renamed"
    And the user chooses "Delete" from the tree profile context menu
    Then tree profile "nested_copy_renamed" is absent
    When the user saves the changes
    Then the saved subtree "nested_copy_renamed" in "Global Team" is absent
    And the saved subtree "nested" in "Global Team" matches the captured subtree

  Scenario: Cut and paste a subtree within the same file
    When the user selects the "Global Team" configuration tab
    And the user refreshes the Config Editor from disk
    And the user switches to tree view mode
    Given the saved subtree "nested" in "Global Team" is captured for context menu testing
    When the user opens the context menu on tree profile "nested"
    And the user chooses "Cut" from the tree profile context menu
    Then tree profile "nested" is marked as cut
    And tree profile "nested.child1" is marked as cut
    And there are no pending changes in the Config Editor
    When the user opens the context menu on tree profile "zosmf2"
    And the user chooses "Paste as Child" from the tree profile context menu
    Then tree profile "zosmf2.nested.child1" is visible
    And tree profile "zosmf2.nested.child2" is visible
    And tree profile "nested" is absent
    When the user saves the changes
    Then the saved subtree "zosmf2.nested" in "Global Team" matches the captured subtree
    And the saved subtree "nested" in "Global Team" is absent

  @cross-file-cut-paste
  Scenario Outline: Cut a subtree from the team file and paste it into the user file
    When the user selects the "Global Team" configuration tab
    And the user refreshes the Config Editor from disk
    And the user creates a Global User configuration for context menu testing
    And the user opens the Profile Wizard modal
    And the user types "clipboard-target" as the profile name
    And the user selects "base" as the profile type
    And the user presses Enter to submit the profile
    And the user saves the changes
    And the user selects the "Global Team" configuration tab
    Given the defaults section is expanded for context menu testing
    When the user selects "nested" in the base default dropdown
    And the user selects "nested.child1" in the zosmf default dropdown
    And the user selects "nested.child2" in the ssh default dropdown
    And the user saves the changes
    Given the saved subtree "nested" in "Global Team" is captured for context menu testing
    When the user opens the context menu on tree profile "nested"
    And the user chooses "Cut" from the tree profile context menu
    Then tree profile "nested" is marked as cut
    When the user selects the "Global User" configuration tab
    And the user opens the context menu on tree profile "clipboard-target"
    And the user chooses "<option>" from the tree profile context menu
    Then tree profile "<destination>.child1" is visible
    And tree profile "<destination>.child2" is visible
    And the "Global Team" configuration tab has unsaved changes
    And the "Global User" configuration tab has unsaved changes
    And the saved subtree "nested" in "Global Team" matches the captured subtree
    And the saved subtree "<destination>" in "Global User" is absent
    When the user saves the changes
    Then there are no pending changes in the Config Editor
    And the saved subtree "<destination>" in "Global User" matches the captured subtree
    And the saved subtree "nested" in "Global Team" is absent
    And no defaults in "Global Team" point to the subtree "nested"
    When the user opens the context menu on tree profile "clipboard-target"
    Then the tree profile context menu offers these options
      | option    | state    |
      | Cut       | enabled  |
      | Copy      | enabled  |
      | Paste     | disabled |
      | Duplicate | enabled  |
      | Rename    | enabled  |
      | Delete    | enabled  |
    When the user dismisses the tree profile context menu
    And the user selects the "Global Team" configuration tab
    Then tree profile "nested" is absent

    Examples:
      | option              | destination             |
      | Paste as Child      | clipboard-target.nested |
      | Paste at Root Level | nested                  |
