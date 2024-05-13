Feature: General UI actions

Scenario: User clicks on the Zowe Explorer icon
    When a user locates the Zowe Explorer icon in the side bar
    Then the user can click on the Zowe Explorer icon

Scenario Outline: expanding the Favorites node
    Given a user who is looking at the Zowe Explorer tree views
    When a user expands the Favorites node in the <tree> view
    Then the Favorites node will expand successfully in the <tree> view

    Examples:
      | tree |
      | Data Sets |
      | USS |
      | Jobs |

Scenario Outline: collapsing the Favorites node
    Given a user who is looking at the Zowe Explorer tree views
    When a user collapses the Favorites node in the <tree> view
    Then the Favorites node will collapse successfully in the <tree> view

    Examples:
      | tree |
      | Data Sets |
      | USS |
      | Jobs |