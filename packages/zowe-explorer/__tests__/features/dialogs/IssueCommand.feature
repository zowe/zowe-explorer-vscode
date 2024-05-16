Feature: Issue TSO Command

Scenario Outline: User wants to issue a command
    Given a user who is looking at the Zowe Explorer tree views
    When a user selects <opt> from the command palette
    Then a quick pick appears to select a profile
    When a user selects a profile
    Then a user can enter in <cmd> as the command and submit it

    Examples:
      | opt | cmd |
      | Issue TSO Command | /profile |
      | Issue MVS Command | /D T |
      | Issue Unix Command | pwd |