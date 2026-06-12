Feature: Issue TSO Command

Scenario Outline: User wants to issue a command
    Given a user who is looking at the Zowe Explorer tree views
    When a user selects <opt> from the command palette
    Then a quick pick appears to select a profile
    When a user selects a profile
    Then a user can enter in <cmd> as the command and submit it
    Then a notification appears with message "<msg>"

    Examples:
      | opt | cmd | msg |
      | Issue TSO Command | PROFILE | TSO command submitted. |
      | Issue Console Command | D T | Console command submitted. |
      | Issue Unix Command | pwd | Unix command submitted. |

