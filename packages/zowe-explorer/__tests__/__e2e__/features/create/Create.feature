Feature: Creating Data Sets and Members

  Background:
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search

  Scenario: User wants to create a new Sequential Dataset (PS)
    When the user right-clicks on the dataset profile and selects "Create New Data Set"
    And enters a new valid sequential dataset name
    Then the new sequential dataset should be created successfully
    And the new dataset should appear in the Data Sets list

  Scenario: User wants to create a new Partitioned Dataset (PDS) and add a member
    When the user right-clicks on the dataset profile and selects "Create New Data Set"
    And enters a new valid partitioned dataset name
    Then the new partitioned dataset should be created successfully
    When the user right-clicks on the newly created PDS and selects "Create New Member"
    And enters a valid member name
    Then the new member should be created successfully
    And the new member should be visible under the PDS node