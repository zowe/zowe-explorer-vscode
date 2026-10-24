Feature: Copying Data Sets and Members

  Background:
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search

  Scenario: User wants to copy a sequential dataset
    Given a test sequential dataset has been created for copying
    When the user right-clicks on the dataset to copy and selects "Copy"
    And the user right-clicks on the profile node to paste and selects "Paste"
    And enters a new name for the copied sequential dataset
    Then the copied sequential dataset should appear in the Data Sets list

  Scenario: User wants to copy a PDS member
    Given a test PDS member has been created for copying
    When the user right-clicks on the member to copy and selects "Copy"
    And the user right-clicks on the PDS to paste and selects "Paste"
    And enters a new name for the copied member
    Then the copied member should appear under the PDS
