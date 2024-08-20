Feature: Jobs table view

Scenario: User wants to list their jobs in the table view
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    And the user has a profile in their Jobs tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user right-clicks on the jobs profile and selects "Show as Table"
    Then the table view appears in the Zowe Resources panel

Scenario: User wants to toggle a column in the table's column selector
    Given a user who has the jobs table view opened
    When the user clicks on the Gear icon in the table view
    Then the column selector menu appears
    And the user can toggle a column on and off