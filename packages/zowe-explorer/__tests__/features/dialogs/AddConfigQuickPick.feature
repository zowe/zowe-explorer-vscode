Feature: "Add Config/Profile" Quick Pick Actions

Scenario: User opens and dismisses the Team Configuration quick pick
    Given a user who is looking at the Add Config quick pick
    Then the user can dismiss the dialog

# Scenario: User creates a global Team Configuration file
#     Given a user who is looking at the Add Config quick pick
#     When a user selects "Create a new Team Configuration file"
#     Then a new configuration file will be created and opened in the editor
#     Then it will ask the user for the desired config location
#     When the user selects the global option
#     Then it will open the config in the editor

Scenario: User edits Team Configuration file
    Given a user who is looking at the Add Config quick pick
    When a user selects "Edit Team Configuration File"
    Then it will open the config in the editor

Scenario Outline: User wants to add a profile to the tree views
    Given a user who is looking at the Add Config quick pick
    When a user selects the first profile in the list
    Then it will prompt the user to add the profile to one or all trees
    When a user selects <opt> to apply to all trees
    Then it will add a tree item for the profile to the correct trees
    
    Examples:
      | opt |
      | No |
      | Yes |
      
Scenario Outline: User wants to toggle a profile node in a tree view
    Given a user who is looking at the Zowe Explorer tree views
    When a user clicks on the first profile in the <tree> view
    Then the profile node will <state>

    Examples:
      | tree | state |
      | Data Sets | expand |
      | Data Sets | collapse |
      | USS | expand |
      | USS | collapse |
      | Jobs | expand |
      | Jobs | collapse |