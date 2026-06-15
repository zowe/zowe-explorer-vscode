Feature: Issue TSO Command

Scenario Outline: User wants to issue a command
    Given a user who is looking at the Zowe Explorer tree views
    When a user selects <opt> from the command palette
    Then a quick pick appears to select a profile
    When a user selects a profile
    And a user selects a TSO profile if required
    Then a user can enter in <cmd> as the command and submit it
    Then a notification appears with message "<msg>"
    And the "<channel>" output channel contains output matching "<regex>"

    Examples:
      | opt | cmd | msg | channel | regex |
      | Issue TSO Command | PROFILE | TSO command submitted. | Zowe TSO Command | (IKJ\d+I\|READY\|PREFIX\() |
      | Issue Console Command | D T | Console command submitted. | Zowe Console Command | (IEE\d+I\|CNZ\d+I\|TIME) |
      | Issue Unix Command | pwd | Unix command submitted. | Zowe Unix Command | \/ |

