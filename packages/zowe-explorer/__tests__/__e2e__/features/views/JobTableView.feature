Feature: Jobs table view

Scenario: User wants to list their jobs in the table view
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    And the user has a profile in their Jobs tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    And the user can right-click on the jobs profile and select "Show as Table"