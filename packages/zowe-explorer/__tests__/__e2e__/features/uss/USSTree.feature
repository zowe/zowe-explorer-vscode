Feature: USS Tree actions

  Background:
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their USS tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When a user expands a USS directory in the list
    Then the node will expand and list its children

  Scenario: User lists files in a USS directory
    Then the USS directory has files listed under it

  Scenario: User opens a USS file
    And the user can select a USS file in the list and open it

  Scenario: User edits and saves a USS file
    And the user can select a USS file in the list and open it
    When the user edits the USS file
    Then the user should be able to save it successfully

  Scenario: User creates and deletes a USS file
    When the user creates a new USS file in the directory
    Then the new USS file appears in the directory listing
    When the user deletes the new USS file from the directory
    Then the USS file no longer appears in the directory listing

  Scenario: User creates and deletes a USS directory
    When the user creates a new USS directory inside the parent
    Then the new USS directory appears in the parent listing
    When the user deletes the new USS directory from the parent
    Then the USS directory no longer appears in the parent listing

  Scenario: User renames a USS file
    When the user creates a new USS file in the directory
    Then the new USS file appears in the directory listing
    When the user renames the new USS file to the renamed file name
    Then the renamed USS file appears in the directory listing
    And the original USS file name no longer appears in the directory listing
    When the user deletes the renamed USS file from the directory

  Scenario: User renames a USS directory
    When the user creates a new USS directory inside the parent
    Then the new USS directory appears in the parent listing
    When the user renames the new USS directory to the renamed directory name
    Then the renamed USS directory appears in the parent listing
    And the original USS directory name no longer appears in the parent listing
    When the user deletes the renamed USS directory from the parent

  Scenario: User opens a USS file with encoding
    When the user opens the USS file with a specific encoding
    Then the USS file opens in the editor with the specified encoding

  Scenario: User copies and pastes a USS file to another directory
    When the user creates a new USS directory inside the parent
    Then the new USS directory appears in the parent listing
    When the user copies the USS test file
    And the user pastes the USS file into the new USS directory
    Then the copied USS file appears in the new USS directory listing
    When the user deletes the new USS directory from the parent
    Then the USS directory no longer appears in the parent listing
