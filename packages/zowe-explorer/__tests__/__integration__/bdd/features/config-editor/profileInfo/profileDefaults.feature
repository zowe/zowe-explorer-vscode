Feature: Profile Defaults

  Scenario: Open Config Editor
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list is set to flat view mode
    And the user clicks the defaults toggle button to open the defaults section

  Scenario Outline: Check each type dropdown for defaults
    When the user selects the <type> default dropdown
    Then the dropdown should have "<value>" as options

    Examples:
      | type  | value                                                                 |
      | zosmf | ,zosmf1,zosmf2,zosmf3,zosmf-dev,zosmf-prod,nested.child1              |
      | tso   | ,tso1                                                                 |
      | ssh   | ,ssh1,nested.child2                                                    |
      | base  | ,base,test-profile,special-chars,nested                                |

  Scenario Outline: Select a new default for each type and save
    When the user selects "<option>" in the <type> default dropdown
    And the user saves the changes
    Then the <type> default should be "<option>"
    And the user saves the changes

    Examples:
      | type  | option        |
      | zosmf | zosmf-dev     |
      | tso   | tso1          |
      | ssh   | nested.child2 |
      | base  | special-chars |
