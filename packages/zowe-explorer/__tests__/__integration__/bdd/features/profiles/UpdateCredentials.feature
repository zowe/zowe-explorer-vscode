Feature: Update credentials for z/OSMF profile

Scenario: Prompt for missing <authType> credentials
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a <authType> profile in their Data Sets tree
    When a user clicks search button for the profile
    Then the user will be prompted for <authType> credentials
    And the profile node icon will be marked as inactive

    Examples:
      | authType |
      | basic |
      | token |
