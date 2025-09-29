Feature: Profile Wizard Modal

  Background:
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list is set to flat view mode

  Scenario: Create a new TSO profile using Profile Wizard
    When the user opens the Profile Wizard modal
    And the user types "testtsoprofile" as the profile name
    And the user selects "tso" as the profile type
    And the user clicks the populate defaults button
    And the user presses Enter to submit the profile
    And the user saves the changes
    Then the profile "testtsoprofile" should exist in the configuration
    And the profile "testtsoprofile" should have TSO properties
    When the user opens the Profile Wizard modal
    And the user types "testzosmfprofile" as the profile name
    And the user selects "zosmf" as the profile type
    And the user clicks the populate defaults button
    And the user presses Enter to submit the profile
    And the user saves the changes
    Then the profile "testzosmfprofile" should exist in the configuration
    And the profile "testzosmfprofile" should have ZOSMF properties