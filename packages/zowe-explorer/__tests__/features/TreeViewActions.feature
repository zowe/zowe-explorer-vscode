Feature: Tree View Actions

Scenario: User clicks on the Zowe Explorer icon
    When a user locates the Zowe Explorer icon in the side bar
    Then the user can click on the Zowe Explorer icon

Scenario Outline: User expands the Favorites node
    Given a user who is looking at the Zowe Explorer tree views
    When a user expands the Favorites node in the <tree> view
    Then the Favorites node expands successfully in the <tree> view

    Examples:
      | tree |
      | Data Sets |
      | USS |
      | Jobs |

Scenario Outline: User collapses the Favorites node
    Given a user who is looking at the Zowe Explorer tree views
    When a user collapses the Favorites node in the <tree> view
    Then the Favorites node collapses successfully in the <tree> view

    Examples:
      | tree |
      | Data Sets |
      | USS |
      | Jobs |

Scenario Outline: User clicks the plus action button
    Given a user who is looking at the Zowe Explorer tree views
    When a user clicks the plus button in the <tree> view
    Then the Add Config quick pick menu appears

    Examples:
      | tree |
      | Data Sets |
      | USS |
      | Jobs |

Scenario Outline: User hides a tree view using the context menu
    Given a user who is looking at the Zowe Explorer tree views
    When a user hides the <tree> view using the context menu
    Then the <tree> view is no longer displayed

    Examples:
      | tree |
      | Data Sets |
      | Unix System Services (USS) |
      | Jobs |
