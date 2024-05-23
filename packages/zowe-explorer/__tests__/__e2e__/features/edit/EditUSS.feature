Feature: Editing in USS

Scenario: User wants to edit a file
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their USS tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When a user expands a USS directory in the list
    Then the node will expand and list its children
    And the user can select a USS file in the list and open it
    When the user edits the USS file
    Then the user should be able to save it successfully

Scenario: User wants to edit a favorited file
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their USS tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When a user expands a USS directory in the list
    Then the node will expand and list its children
    And the user can right-click on the child node and add it as a favorite
    When the user finds the child node in Favorites
    Then the user can select the favorite in the list and open it
    When the user edits the USS file
    Then the user should be able to save it successfully