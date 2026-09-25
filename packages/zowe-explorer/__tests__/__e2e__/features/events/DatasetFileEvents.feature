@fileEvents
Feature: Data Set File System Events

  Background:
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    And a user expands a PDS in the list

  Scenario: A PDS member created outside of Zowe Explorer is reported when the data sets are refreshed
    Given Zowe Explorer is recording data set file system events
    When a PDS member is created outside of Zowe Explorer
    And a user refreshes the Data Sets view
    Then a Created event is emitted for the new PDS member
    And a Changed event is emitted for the parent PDS

  Scenario: Creating a member through Zowe Explorer reports its PDS as changed
    Given Zowe Explorer is recording data set file system events
    When the user creates a new member in the PDS using the Create New Member action
    Then a Changed event is emitted for the parent PDS
