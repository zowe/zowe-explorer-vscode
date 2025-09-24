Feature: Profile Tab File Opening

Background:
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list is set to flat view mode

Scenario: Test profile header buttons
    When a user right clicks a configuration tab and clicks open schema
    Then a new file should be opened
    Then close the current tab
    When a user right clicks a configuration tab and clicks open file
    Then a new file should be opened
    Then close the current tab
    When a user right clicks a configuration tab and clicks toggle autostore
    And the user saves the changes
    Then autostore should be "false"
    When a user right clicks a configuration tab and clicks toggle autostore
    And the user saves the changes
    Then autostore should be "true"