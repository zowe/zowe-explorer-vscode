Feature: Issue TSO Command with default TSO profile set

Scenario Outline: User wants to issue a tso command
    Given a user who is looking at the Zowe Explorer tree views
    And the default tso profile is set to true
    When a user selects <opt> from the command palette
    Then a quick pick appears to select a profile
    When a user selects a profile
    Then a user can enter in status as the command and submit it

    Examples:
      | opt |
      | Issue TSO Command |