Feature: Jobs Tree - Favorited Node Actions

Scenario: User adds a job search filter to Favorites
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Jobs tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user right-clicks on the profile node and selects "Add to Favorites"
    Then the profile appears as a favorited node under the Favorites section in the Jobs tree

Scenario: User views and opens spool files from a favorited job node
    Given the Jobs tree has a favorited profile node
    When the user expands a job under the favorited profile
    Then the job node will expand and list its spool files
    When the user selects the first spool file under the favorited job
    Then the spool file content is displayed in the editor

Scenario: User gets JCL from a favorited job node
    Given the Jobs tree has a favorited profile node
    When the user right-clicks on a job under the favorited profile and selects "Get JCL"
    Then the JCL content for the job is displayed in the editor

Scenario: User opens a spool file with encoding from a favorited job node
    Given the Jobs tree has a favorited profile node
    And a job under the favorited profile is expanded
    When the user right-clicks on the first spool file under the favorited job and selects "Open with Encoding"
    Then a quick pick appears to select an encoding
    When the user selects an encoding
    Then the spool file content is displayed in the editor

Scenario: User removes a favorited job search filter from Favorites
    Given the Jobs tree has a favorited job search filter node
    When the user right-clicks on the favorited job search filter and selects "Remove Favorite"
    Then the favorited job search filter is no longer present under Favorites in the Jobs tree
