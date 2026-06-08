Feature: Jobs Tree Actions

Scenario: User wants to submit a job from the Data Sets tree
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Data Sets tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When a user expands the JCL PDS in the list
    And the user opens the JCL PDS member
    And the user edits the JCL PDS member to contain a sleep job JCL
    And the user saves the JCL PDS member
    When the user right-clicks on the JCL PDS member and selects "Submit Job"
    Then a notification appears stating that the job was submitted

Scenario: User wants to view and open spool files in the Jobs tree
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Jobs tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user expands a job in the list
    Then the job node will expand and list its spool files
    When the user selects the first spool file
    Then the spool file content is displayed in the editor

Scenario: User wants to open a spool file with encoding
    Given a user who has expanded a job in the list
    When the user right-clicks on the first spool file and selects "Open with Encoding"
    Then a quick pick appears to select an encoding
    When the user selects an encoding
    Then the spool file content is displayed in the editor

Scenario: User wants to get JCL for a job
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Jobs tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user right-clicks on a job in the list and selects "Get JCL"
    Then the JCL content for the job is displayed in the editor

@skip
Scenario: User wants to poll active jobs
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Jobs tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user right-clicks on a job in the list and selects "Start Polling Active Jobs"
    Then the status or icon of the job indicates it is being polled
    When the user right-clicks on a job in the list and selects "Stop Polling Active Jobs"
    Then the status or icon of the job indicates polling has stopped

Scenario: User wants to cancel a job
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Jobs tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user right-clicks on an active job and selects "Cancel Job"
    Then a confirmation dialog appears to cancel the job
    When the user confirms the cancellation
    Then the job is cancelled successfully


# Blocked by https://github.com/zowe/zowe-explorer-vscode/issues/4315: confirmation prompt not interactable via e2e. It needs skipped to verify deletion
@skip
Scenario: User wants to delete a job
    Given a user who is looking at the Zowe Explorer tree views
    And the user has a profile in their Jobs tree
    When a user sets a filter search on the profile
    Then the profile node will list results of the filter search
    When the user right-clicks on the job and selects "Delete Job"
    Then a confirmation dialog appears to delete the job
    When the user confirms the deletion
    Then the job is removed from the list
