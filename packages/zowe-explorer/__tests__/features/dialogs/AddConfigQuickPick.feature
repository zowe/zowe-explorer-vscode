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