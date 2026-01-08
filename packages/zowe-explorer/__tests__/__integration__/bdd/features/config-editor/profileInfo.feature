Feature: Profile Info Management - Comprehensive Testing

  @config-editor @profile-defaults
  Scenario: Open Config Editor and check defaults
    When a user opens the Zowe Config Editor from the Command Palette
    Then the Zowe Config Editor webview should be opened
    And the profile list is set to flat view mode
    And the user clicks the defaults toggle button to open the defaults section

  @config-editor @profile-defaults
  Scenario Outline: Check each type dropdown for defaults
    When the user selects the <type> default dropdown
    Then the dropdown should have "<value>" as options

    Examples:
      | type  | value                                                                 |
      | zosmf | ,zosmf1,zosmf2,zosmf3,zosmf-dev,zosmf-prod,nested.child1              |
      | tso   | ,tso1                                                                 |
      | ssh   | ,ssh1,nested.child2                                                    |
      | base  | ,base,test-profile,special-chars,nested                                |

  @config-editor @profile-defaults
  Scenario Outline: Select a new default for each type and save
    When the user selects "<option>" in the <type> default dropdown
    And the user saves the changes
    Then the <type> default should be "<option>"

    Examples:
      | type  | option        |
      | zosmf | zosmf-dev     |
      | tso   | tso1          |
      | ssh   | nested.child2 |
      | base  | special-chars |

  @config-editor @profile-headers
  Scenario: Test profile header buttons
    When the user clicks on the "test-profile" profile entry
    And the user clicks the "set as default" button
    And the user saves the changes
    Then the zowe.config.json should have "test-profile" as the default base profile

    When the user clicks on the "nested.child1" profile entry
    Then the profile selection should be successful
    Then there should be 4 profile properties
    When the user clicks the "hide merged properties" button
    Then there should be 2 profile properties
    Then the hide merged properties button click should be successful

    When the user clicks on the "zosmf-dev" profile entry
    When the user clicks the "rename profile" button
    When the user appends "_test" to the profile name in the modal
    When the user clicks the "rename confirm" button
    When the user clicks on the "nested.child2" profile entry
    When the user clicks the "rename profile" button
    When the user appends "_test" to the profile name in the modal
    When the user clicks the "rename confirm" button
    And the user saves the changes
    Then the profile tree should contain expected profiles from zowe.config.json with proper renames

    When the user clicks on the "zosmf-dev_test" profile entry
    When the user clicks the "delete profile" button
    When the user clicks the "confirm delete profile" button
    When the user clicks on the "nested.child2_test" profile entry
    When the user clicks the "delete profile" button
    When the user clicks the "confirm delete profile" button
    And the user saves the changes
    Then the profile tree should contain expected profiles from zowe.config.json with proper deletions

  @config-editor @profile-wizard
  Scenario: Create new profiles using Profile Wizard
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

  @config-editor @property-sorting
  Scenario: Test property sorting dropdown functionality
    When the user switches to flat view mode
    When the user selects the "nested.child1" to view its properties
    Then the profile details section should be displayed
    And the property sort dropdown should show "Alphabetical" as selected by default
    And the properties should be displayed in alphabetical order
    
    When the user clicks on the property sort dropdown
    And the user selects "Merged First" from the property sort dropdown
    Then the property sort dropdown should show "Merged First" as selected
    And the properties should be displayed according to the sort order
    
    When the user clicks on the property sort dropdown
    And the user selects "Merged Last" from the property sort dropdown
    Then the property sort dropdown should show "Merged Last" as selected
    And the properties should be displayed according to the sort order
    
    When the user clicks on the property sort dropdown
    And the user selects "Alphabetical" from the property sort dropdown
    Then the property sort dropdown should show "Alphabetical" as selected
    And the properties should be displayed in alphabetical order
    
    Then the property sort dropdown should maintain the current sort order
    And the properties should be displayed according to the current sort order

  @config-editor @property-editing
  Scenario: Test property editing functionality on special-chars profile
    When the user switches to flat view mode
    When the user selects the "special-chars" to view its properties
    Then the profile details section should be displayed
    
    When the user clicks on the "host" property input field
    Then the input field should be focused and editable
    When the user clears the current value
    And the user types "modified-host.example.com" into the input field
    Then the input field should contain "modified-host.example.com"
    
    When the user clicks on the "port" property input field
    Then the input field should be focused and editable
    When the user clears the current value
    And the user types "9999" into the input field
    Then the input field should contain "9999"
    
    When the user clicks on the "rejectUnauthorized" property input field
    Then the input field should be focused and editable
    When the user clears the current value
    And the user types "true" into the input field
    Then the input field should contain "true"
    
    When the user clicks the save button
    Then the changes should be saved successfully
    
    When the user clicks the delete button for the "port" property
    Then the delete button should be clicked successfully
    
    When the user clicks the save button
    Then the changes should be saved successfully
    
    When the user clicks the add property button
    Then the add property modal should be displayed
    When the user enters "host" as the property key
    And the user enters "new-host.example.com" as the property value
    And the user clicks the add property button in the modal
    Then the property should be added to the profile
    When the user closes the modal
    Then the modal should be closed
    
    When the user clicks the add property button
    Then the add property modal should be displayed
    When the user enters "rejectUnauthorized" as the property key
    And the user selects "false" as the boolean value
    And the user clicks the add property button in the modal
    Then the property should be added to the profile
    When the user closes the modal
    Then the modal should be closed
    
    When the user clicks the add property button
    Then the add property modal should be displayed
    When the user enters "port" as the property key
    And the user enters "8080" as the number value
    And the user clicks the add property button in the modal
    Then the property should be added to the profile
    When the user closes the modal
    Then the modal should be closed
    
    When the user clicks the add property button
    Then the add property modal should be displayed
    When the user enters "password" as the property key
    And the user enters "secure-password-123" as the property value
    And the user toggles the secure property option
    And the user clicks the add property button in the modal
    Then the property should be added to the profile
    When the user closes the modal
    Then the modal should be closed
    
    When the user clicks the save button
    Then the changes should be saved successfully
    
    Then the host property should contain new-host.example.com in the config file
    And the rejectUnauthorized property should contain false in the config file
    And the port property should contain 8080 in the config file
    And the password property should be in the secure array in the config file

