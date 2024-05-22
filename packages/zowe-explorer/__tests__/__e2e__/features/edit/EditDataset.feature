Feature: Editing in Data Sets

Scenario: User wants to edit a PDS member
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When a user expands a PDS in the list
    Then the node will expand and list its children
    And the user can select a PDS member in the list and open it
    When the user edits the PDS member
    Then the user should be able to save it successfully

# Scenario: User wants to edit a PS - no conflict

# Scenario: User wants to edit a PS - conflict

# Scenario: User wants to edit a PDS member - conflict
