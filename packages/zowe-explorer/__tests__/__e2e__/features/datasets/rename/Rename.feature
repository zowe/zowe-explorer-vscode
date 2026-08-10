Feature: Renaming Data Sets and Members

  Background:
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search

  Scenario: User wants to rename an existing Sequential Dataset (PS)
    Given a test sequential dataset has been created for renaming
    When the user right-clicks on the dataset to rename and selects "Rename Data Set"
    And enters a new valid name for the sequential dataset
    Then the new dataset name should appear in the Data Sets list
    And the old dataset name should no longer exist

  Scenario: User wants to rename an existing Partitioned Dataset (PDS)
    Given a test partitioned dataset has been created for renaming
    When the user right-clicks on the dataset to rename and selects "Rename Data Set"
    And enters a new valid name for the partitioned dataset
    Then the new dataset name should appear in the Data Sets list
    And the old dataset name should no longer exist

  Scenario: User wants to rename an existing PDS member
    Given a test PDS member has been created for renaming
    When the user right-clicks on the PDS member to rename and selects "Rename Member"
    And enters a new valid name for the member
    Then the new member name should be visible under the PDS node
    And the old member name should no longer exist under the PDS
