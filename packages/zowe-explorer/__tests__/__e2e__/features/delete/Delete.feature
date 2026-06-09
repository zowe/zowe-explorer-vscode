Feature: Deleting Data Sets and Members

  Background:
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search

  Scenario: User wants to delete a sequential dataset
    Given a test sequential dataset has been created for deletion
    When the user right-clicks on the test sequential dataset and selects "Delete"
    And the user confirms the deletion
    Then the sequential dataset should no longer appear in the Data Sets list

  Scenario: User wants to delete a PDS member
    Given a test PDS member has been created for deletion
    When the user right-clicks on the test PDS member and selects "Delete"
    And the user confirms the deletion
    Then the PDS member should no longer appear under the PDS