@CustomConfig
Feature: Show Config Error Dialog

Scenario: Initializing Zowe Explorer with a broken profile
    When a user opens Zowe Explorer
    Then the Show Config dialog should appear
    When the user clicks on the "Show Config" button
    Then the config should appear in the editor