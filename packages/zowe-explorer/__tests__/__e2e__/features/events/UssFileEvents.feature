@fileEvents
Feature: USS File System Events

  Background:
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their USS tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When a user expands a USS directory in the list
    Then the node will expand and list its children

  Scenario: A USS file created outside of Zowe Explorer is reported when the directory is refreshed
    Given Zowe Explorer is recording USS file system events
    When a USS file is created outside of Zowe Explorer
    And a user refreshes the USS directory
    Then a Created event is emitted for the new USS file
    And a Changed event is emitted for the parent directory

  Scenario: A USS file deleted outside of Zowe Explorer is reported when the directory is refreshed
    Given a USS file created outside of Zowe Explorer that Zowe Explorer has already listed
    And Zowe Explorer is recording USS file system events
    When the USS file is deleted outside of Zowe Explorer
    And a user refreshes the USS directory
    Then a Deleted event is emitted for the USS file
    And a Changed event is emitted for the parent directory

  Scenario: Creating a file through Zowe Explorer reports its directory as changed
    Given Zowe Explorer is recording USS file system events
    When the user creates a new USS file using the Create File action
    Then a Changed event is emitted for the parent directory
